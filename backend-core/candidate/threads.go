package candidate

import (
	"context"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const maxMessage = 4000

func (s *Store) ListThreads(ctx context.Context, userID, companyID string, now time.Time) ([]Thread, error) {
	filter := bson.D{{Key: "candidateUserId", Value: userID}}
	if companyID != "" {
		filter = bson.D{{Key: "companyId", Value: companyID}}
	}
	cursor, err := s.collection(threadsCollection).Find(ctx, filter, options.Find().SetSort(bson.D{{Key: "createdAt", Value: -1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	docs := []storedThread{}
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, err
	}
	out := make([]Thread, 0, len(docs))
	for _, doc := range docs {
		thread, err := s.viewThread(ctx, doc, userID, companyID, now)
		if err != nil {
			return nil, err
		}
		out = append(out, thread)
	}
	return out, nil
}

func (s *Store) GetThread(ctx context.Context, userID, companyID, threadID string, now time.Time) (Thread, error) {
	doc, err := s.threadDoc(ctx, threadID)
	if err != nil {
		return Thread{}, err
	}
	if !threadVisibleTo(doc, userID, companyID) {
		return Thread{}, ErrForbidden
	}
	thread, err := s.viewThread(ctx, doc, userID, companyID, now)
	if err != nil {
		return Thread{}, err
	}
	_ = s.markRead(ctx, threadID, userID, now)
	return thread, nil
}

func (s *Store) PostMessage(ctx context.Context, userID, companyID, threadID, body string, now time.Time) (Message, error) {
	text := strings.TrimSpace(body)
	if text == "" || len([]rune(text)) > maxMessage {
		return Message{}, ErrInvalidInput
	}
	doc, err := s.threadDoc(ctx, threadID)
	if err != nil {
		return Message{}, err
	}
	if !threadVisibleTo(doc, userID, companyID) {
		return Message{}, ErrForbidden
	}
	from := AuthorCandidate
	if companyID != "" && doc.CompanyID == companyID {
		from = AuthorCompany
	}
	id, err := newPublicID()
	if err != nil {
		return Message{}, err
	}
	msg := Message{
		ID:        id,
		ThreadID:  threadID,
		From:      from,
		AuthorID:  userID,
		Text:      text,
		CreatedAt: now.UTC(),
	}
	if _, err := s.collection(messagesCollection).InsertOne(ctx, msg); err != nil {
		return Message{}, err
	}
	_ = s.markRead(ctx, threadID, userID, now)
	return presentMessage(msg, userID, companyID, now), nil
}

func (s *Store) UnreadCount(ctx context.Context, userID, companyID string, now time.Time) (int, error) {
	threads, err := s.ListThreads(ctx, userID, companyID, now)
	if err != nil {
		return 0, err
	}
	total := 0
	for _, thread := range threads {
		total += thread.Unread
	}
	return total, nil
}

func (s *Store) ensureThread(ctx context.Context, app Application, now time.Time) error {
	if app.CompanyID == "" {
		return nil
	}
	user, _, err := s.accounts.Account(ctx, app.UserID)
	if err != nil {
		return err
	}
	id, err := newPublicID()
	if err != nil {
		return err
	}
	_, err = s.collection(threadsCollection).UpdateOne(ctx, bson.D{{Key: "applicationId", Value: app.ID}}, bson.D{
		{Key: "$setOnInsert", Value: storedThread{
			ID:              id,
			ApplicationID:   app.ID,
			CandidateUserID: app.UserID,
			CompanyID:       app.CompanyID,
			CandidateName:   user.Name,
			CompanyName:     app.Company,
			JobTitle:        app.Title,
			JobID:           app.JobID,
			Location:        app.Location,
			CreatedAt:       now.UTC(),
		}},
	}, options.UpdateOne().SetUpsert(true))
	return err
}

// CompanyThreadJob is the job behind a thread this company owns.
// Another company's thread is forbidden. The caller decides whether that job is visible.
func (s *Store) CompanyThreadJob(ctx context.Context, companyID, threadID string) (string, error) {
	doc, err := s.threadDoc(ctx, threadID)
	if err != nil {
		return "", err
	}
	if companyID == "" || doc.CompanyID != companyID {
		return "", ErrForbidden
	}
	return doc.JobID, nil
}

func (s *Store) threadDoc(ctx context.Context, id string) (storedThread, error) {
	var doc storedThread
	err := s.collection(threadsCollection).FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if notFound(err) {
		return storedThread{}, ErrNotFound
	}
	if err != nil {
		return storedThread{}, err
	}
	return doc, nil
}

func (s *Store) viewThread(ctx context.Context, doc storedThread, userID, companyID string, now time.Time) (Thread, error) {
	messages, err := s.threadMessages(ctx, doc.ID)
	if err != nil {
		return Thread{}, err
	}
	readAt, err := s.readAt(ctx, doc.ID, userID)
	if err != nil {
		return Thread{}, err
	}
	stage := ""
	if app, err := s.applicationByID(ctx, doc.CandidateUserID, doc.ApplicationID); err == nil {
		stage = stageLabel(app.ColumnID)
	}
	presented := make([]Message, 0, len(messages))
	unread := 0
	for _, msg := range messages {
		if messageUnread(msg, userID, companyID, readAt) {
			unread++
		}
		presented = append(presented, presentMessage(msg, userID, companyID, now))
	}
	kind := "company"
	title := doc.CompanyName
	if companyID != "" {
		kind = "person"
		title = doc.CandidateName
	}
	hrefJob := "/jobs/" + doc.JobID
	if companyID != "" {
		hrefJob = "/company/applicants"
	}
	return Thread{
		ID:            doc.ID,
		ApplicationID: doc.ApplicationID,
		Kind:          kind,
		Title:         title,
		Subtitle:      doc.JobTitle,
		Stage:         stage,
		Unread:        unread,
		Details: []ThreadDetail{
			{Label: "Role", Value: doc.JobTitle},
			{Label: "Location", Value: doc.Location},
		},
		Links: []ThreadLink{
			{Label: "View job", Href: hrefJob},
			{Label: "Interviews", Href: interviewLink(companyID != "")},
		},
		Messages: presented,
	}, nil
}

func (s *Store) threadMessages(ctx context.Context, threadID string) ([]Message, error) {
	cursor, err := s.collection(messagesCollection).Find(ctx, bson.D{{Key: "threadId", Value: threadID}}, options.Find().SetSort(bson.D{{Key: "createdAt", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	items := []Message{}
	if err := cursor.All(ctx, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Store) readAt(ctx context.Context, threadID, userID string) (time.Time, error) {
	var rec storedRead
	err := s.collection(threadReadsCollection).FindOne(ctx, bson.D{{Key: "threadId", Value: threadID}, {Key: "userId", Value: userID}}).Decode(&rec)
	if notFound(err) {
		return time.Time{}, nil
	}
	if err != nil {
		return time.Time{}, err
	}
	return rec.ReadAt, nil
}

func (s *Store) markRead(ctx context.Context, threadID, userID string, now time.Time) error {
	_, err := s.collection(threadReadsCollection).UpdateOne(ctx, bson.D{
		{Key: "threadId", Value: threadID},
		{Key: "userId", Value: userID},
	}, bson.D{{Key: "$set", Value: storedRead{ThreadID: threadID, UserID: userID, ReadAt: now.UTC()}}}, options.UpdateOne().SetUpsert(true))
	return err
}

// messageUnread is a candidate inbox badge. Ordinary events stay quiet.
// A notice event badges the candidate only; the hiring team does not see it as unread.
func messageUnread(msg Message, userID, companyID string, readAt time.Time) bool {
	if !msg.CreatedAt.After(readAt) || msg.AuthorID == userID {
		return false
	}
	if msg.From == AuthorEvent {
		return msg.Notice && companyID == ""
	}
	return true
}

func threadVisibleTo(doc storedThread, userID, companyID string) bool {
	if doc.CandidateUserID == userID {
		return true
	}
	return companyID != "" && doc.CompanyID == companyID
}

func presentMessage(msg Message, userID, companyID string, now time.Time) Message {
	from := "them"
	switch {
	case msg.From == AuthorEvent:
		from = "event"
	case msg.AuthorID == userID:
		from = "you"
	case companyID != "" && msg.From == AuthorCompany:
		from = "you"
	}
	status := ""
	if from == "you" {
		status = "sent"
	}
	msg.From = from
	msg.Day = messageDay(msg.CreatedAt, now)
	msg.Time = msg.CreatedAt.Local().Format("3:04 PM")
	msg.Status = status
	return msg
}

func messageDay(at, now time.Time) string {
	local := at.Local()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	day := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, local.Location())
	diff := int(today.Sub(day).Hours() / 24)
	if diff == 0 {
		return "Today"
	}
	if diff == 1 {
		return "Yesterday"
	}
	return local.Format("Jan 2")
}

func stageLabel(stage string) string {
	switch stage {
	case StageApplied:
		return "Applied"
	case StageScreening:
		return "Screening"
	case StageInterview:
		return "Interview"
	case StageOffer:
		return "Offer"
	case StageClosed:
		return "Closed"
	default:
		return ""
	}
}

func interviewLink(company bool) string {
	if company {
		return "/company/interviews"
	}
	return "/interviews"
}
