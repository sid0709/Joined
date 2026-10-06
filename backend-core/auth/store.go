package auth

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

const (
	usersCollection    = "users"
	sessionsCollection = "sessions"
	membersCollection  = "company_members"
	companySearchLimit = 8
	minCompanyQuery    = 2
)

type Store struct {
	client    *mongo.Client
	db        string
	companies string
	data      UserData
	records   AccountRecords
	export    AccountSource
	exportMu  sync.Mutex
	exportAt  map[string]time.Time
	// passwordHasher allows injection for testing timing
	passwordHasher func(password string) ([]byte, []byte, error)
}

func NewStore(client *mongo.Client, db, companies string) *Store {
	s := &Store{
		client:         client,
		db:             db,
		companies:      companies,
		passwordHasher: hashPassword,
	}
	s.records = &mongoAccountRecords{store: s}
	return s
}

func (s *Store) SetUserData(data UserData) {
	s.data = data
}

func (s *Store) Account(ctx context.Context, userID string) (User, time.Time, error) {
	var user storedUser
	err := s.collection(usersCollection).FindOne(ctx, bson.D{{Key: "id", Value: userID}}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return User{}, time.Time{}, ErrNotFound
	}
	if err != nil {
		return User{}, time.Time{}, err
	}
	if err := s.ensureRole(ctx, &user); err != nil {
		return User{}, time.Time{}, err
	}
	return User{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role}, user.CreatedAt, nil
}

func (s *Store) SetName(ctx context.Context, userID, name string) error {
	name = strings.TrimSpace(name)
	if name == "" || len([]rune(name)) > maxNameLength {
		return ErrInvalidInput
	}
	result, err := s.collection(usersCollection).UpdateOne(ctx, bson.D{{Key: "id", Value: userID}}, bson.D{
		{Key: "$set", Value: bson.D{{Key: "name", Value: name}}},
	})
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) EnsureIndexes(ctx context.Context) error {
	_, err := s.collection(usersCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "email", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}
	_, err = s.collection(sessionsCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "tokenHash", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}
	_, err = s.collection(membersCollection).Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    bson.D{{Key: "userId", Value: 1}},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		return err
	}
	if err := s.ensureStaffIndexes(ctx); err != nil {
		return err
	}
	if err := s.ensureGoogleIndexes(ctx); err != nil {
		return err
	}
	return s.ensureEmailIndexes(ctx)
}

func (s *Store) Signout(ctx context.Context, token string) error {
	if token == "" {
		return nil
	}
	_, err := s.collection(sessionsCollection).DeleteOne(ctx, bson.D{{Key: "tokenHash", Value: hashToken(token)}})
	return err
}

func (s *Store) Session(ctx context.Context, token string, now time.Time) (Session, error) {
	if token == "" {
		return Session{}, ErrInvalidLogin
	}
	// In-memory records (tests) have no Mongo client. Production still reads the sessions collection.
	if s.client == nil {
		record, err := s.records.SessionByToken(ctx, hashToken(token))
		if errors.Is(err, ErrNotFound) {
			return Session{}, ErrInvalidLogin
		}
		if err != nil {
			return Session{}, err
		}
		if !record.ExpiresAt.After(now) {
			return Session{}, ErrInvalidLogin
		}
		return s.view(ctx, record.UserID)
	}
	var record storedSession
	err := s.collection(sessionsCollection).FindOne(ctx, bson.D{{Key: "tokenHash", Value: hashToken(token)}}).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Session{}, ErrInvalidLogin
	}
	if err != nil {
		return Session{}, err
	}
	if !record.ExpiresAt.After(now) {
		return Session{}, ErrInvalidLogin
	}
	return s.view(ctx, record.UserID)
}

func (s *Store) AttachCompany(ctx context.Context, token string, choice CompanyChoice, now time.Time) (Session, error) {
	session, err := s.Session(ctx, token, now)
	if err != nil {
		return Session{}, err
	}
	if session.User.Role != RoleEmployee {
		return Session{}, &RoleError{Role: session.User.Role}
	}
	if session.Company != nil {
		return Session{}, ErrHasCompany
	}
	choice, err = normalizeCompany(choice)
	if err != nil {
		return Session{}, err
	}
	inviteRole := ""
	if choice.ID != "" {
		inviteRole, err = s.pendingInviteRole(ctx, choice.ID, session.User.Email)
		if err != nil {
			return Session{}, err
		}
	}
	memberRole, hiringRole, err := MembershipForJoin(choice.ID != "", inviteRole)
	if err != nil {
		return Session{}, err
	}
	if choice.ID != "" {
		if _, _, err = s.companyByID(ctx, choice.ID); err != nil {
			return Session{}, err
		}
	}
	if err := s.attach(ctx, session.User.ID, choice, memberRole, hiringRole, now); err != nil {
		return Session{}, err
	}
	if choice.ID != "" {
		if err := s.deletePendingInvite(ctx, choice.ID, session.User.Email); err != nil {
			return Session{}, err
		}
	}
	return s.view(ctx, session.User.ID)
}

func (s *Store) DeleteAccount(ctx context.Context, token string, now time.Time) error {
	session, err := s.Session(ctx, token, now)
	if err != nil {
		return err
	}
	userID := session.User.ID
	if s.client == nil {
		if s.data != nil {
			if err := s.data.DeleteUser(ctx, userID, ""); err != nil {
				return err
			}
		}
		if err := s.records.DeleteSessionsByUser(ctx, userID); err != nil {
			return err
		}
		return s.records.DeleteUser(ctx, userID)
	}
	var member storedMember
	err = s.collection(membersCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&member)
	if err != nil && !errors.Is(err, mongo.ErrNoDocuments) {
		return err
	}
	ownedCompanyID := ""
	if err == nil {
		_, createdBy, companyErr := s.companyByID(ctx, member.CompanyID)
		if companyErr != nil && !errors.Is(companyErr, ErrNotFound) {
			return companyErr
		}
		if removesCompany(createdBy, userID) {
			ownedCompanyID = member.CompanyID
		}
	}
	if s.data != nil {
		if err := s.data.DeleteUser(ctx, userID, ownedCompanyID); err != nil {
			return err
		}
	}
	if member.UserID != "" {
		if err := s.removeMembership(ctx, userID, member.CompanyID); err != nil {
			return err
		}
	}

	if _, err := s.collection(sessionsCollection).DeleteMany(ctx, bson.D{{Key: "userId", Value: userID}}); err != nil {
		return err
	}
	_, err = s.collection(usersCollection).DeleteOne(ctx, bson.D{{Key: "id", Value: userID}})
	return err
}

func (s *Store) removeMembership(ctx context.Context, userID, companyID string) error {
	_, createdBy, err := s.companyByID(ctx, companyID)
	if err != nil && !errors.Is(err, ErrNotFound) {
		return err
	}
	if removesCompany(createdBy, userID) {
		if _, err := s.collection(s.companies).DeleteOne(ctx, bson.D{
			{Key: "id", Value: companyID},
			{Key: "createdBy", Value: userID},
		}); err != nil {
			return err
		}
		_, err = s.collection(membersCollection).DeleteMany(ctx, bson.D{{Key: "companyId", Value: companyID}})
		return err
	}
	_, err = s.collection(membersCollection).DeleteOne(ctx, bson.D{{Key: "userId", Value: userID}})
	return err
}

// SearchCompanies is the scout company name search. Joined hiring setup does not
// use it; that list is InvitedCompanies.
func (s *Store) SearchCompanies(ctx context.Context, query string) ([]Company, error) {
	query = strings.TrimSpace(query)
	if len([]rune(query)) < minCompanyQuery {
		return []Company{}, nil
	}
	filter := bson.D{{Key: "companyName", Value: bson.D{
		{Key: "$regex", Value: regexp.QuoteMeta(query)},
		{Key: "$options", Value: "i"},
	}}}
	cursor, err := s.collection(s.companies).Find(ctx, filter, options.Find().
		SetLimit(companySearchLimit).
		SetProjection(bson.D{
			{Key: "id", Value: 1},
			{Key: "companyName", Value: 1},
			{Key: "companyUrl", Value: 1},
			{Key: "companyLogo", Value: 1},
		}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	hits := []Company{}
	for cursor.Next(ctx) {
		var doc struct {
			ID   string `bson:"id"`
			Name string `bson:"companyName"`
			URL  string `bson:"companyUrl"`
			Logo string `bson:"companyLogo"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		if doc.ID == "" || doc.Name == "" {
			continue
		}
		hits = append(hits, Company{ID: doc.ID, Name: doc.Name, URL: doc.URL, Logo: doc.Logo})
	}
	return hits, cursor.Err()
}

func (s *Store) issue(ctx context.Context, userID string, now time.Time) (string, Session, error) {
	token, tokenHash, err := newToken()
	if err != nil {
		return "", Session{}, err
	}
	err = s.records.InsertSession(ctx, SessionRecord{
		TokenHash: tokenHash,
		UserID:    userID,
		ExpiresAt: now.UTC().Add(sessionLifetime),
		CreatedAt: now.UTC(),
	})
	if err != nil {
		return "", Session{}, err
	}
	session, err := s.view(ctx, userID)
	if err != nil {
		return "", Session{}, err
	}
	return token, session, nil
}

func (s *Store) attach(ctx context.Context, userID string, choice CompanyChoice, memberRole, hiringRole string, now time.Time) error {
	companyID := choice.ID
	if companyID == "" {
		id, err := newPublicID()
		if err != nil {
			return err
		}
		companyID = id
		_, err = s.collection(s.companies).InsertOne(ctx, bson.D{
			{Key: "id", Value: companyID},
			{Key: "companyName", Value: choice.Name},
			{Key: "companyUrl", Value: choice.URL},
			{Key: "companyKey", Value: companyKey(choice.Name)},
			{Key: "companyLogo", Value: ""},
			{Key: "jobCount", Value: 0},
			{Key: "jobIds", Value: bson.A{}},
			{Key: "createdBy", Value: userID},
			{Key: "createdAt", Value: now.UTC()},
			{Key: "verificationStatus", Value: jobs.VerificationPending},
			{Key: "claimed", Value: true},
			{Key: "claimMethod", Value: jobs.ClaimManual},
			{Key: "claimedBy", Value: userID},
		})
		if err != nil {
			return err
		}
	}
	member := storedMember{
		UserID:     userID,
		CompanyID:  companyID,
		Role:       memberRole,
		HiringRole: hiringRole,
		CreatedAt:  now.UTC(),
	}
	_, err := s.collection(membersCollection).InsertOne(ctx, member)
	if mongo.IsDuplicateKeyError(err) {
		return ErrHasCompany
	}
	return err
}

func (s *Store) view(ctx context.Context, userID string) (Session, error) {
	account, err := s.records.UserByID(ctx, userID)
	if err != nil {
		return Session{}, err
	}
	user := storedUser{
		ID:        account.ID,
		Name:      account.Name,
		Email:     account.Email,
		Role:      account.Role,
		CreatedAt: account.CreatedAt,
	}
	if err := s.ensureRole(ctx, &user); err != nil {
		return Session{}, err
	}
	session := Session{User: User{ID: user.ID, Name: user.Name, Email: user.Email, Role: user.Role}}
	company, err := s.records.CompanyMembership(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		return session, nil
	}
	if err != nil {
		return Session{}, err
	}
	session.Company = company
	return session, nil
}

func (s *Store) companyByID(ctx context.Context, id string) (Company, string, error) {
	var doc struct {
		ID        string `bson:"id"`
		Name      string `bson:"companyName"`
		URL       string `bson:"companyUrl"`
		Logo      string `bson:"companyLogo"`
		CreatedBy string `bson:"createdBy"`
	}
	err := s.collection(s.companies).FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) || doc.ID == "" {
		return Company{}, "", ErrNotFound
	}
	if err != nil {
		return Company{}, "", err
	}
	return Company{ID: doc.ID, Name: doc.Name, URL: doc.URL, Logo: doc.Logo}, doc.CreatedBy, nil
}

const scoutProfilesCollection = "scout_profiles"

// ensureRole fills a role for accounts created before roles were stored.
// A company membership is a recruiter. A scout profile is a scout. Anyone else
// is a job hunter. A role that is already set is left alone.
func (s *Store) ensureRole(ctx context.Context, user *storedUser) error {
	if user.Role != "" {
		return nil
	}
	role := RoleCandidate
	err := s.collection(membersCollection).FindOne(ctx, bson.D{{Key: "userId", Value: user.ID}}).Err()
	switch {
	case err == nil:
		role = RoleEmployee
	case errors.Is(err, mongo.ErrNoDocuments):
		n, countErr := s.collection(scoutProfilesCollection).CountDocuments(ctx, bson.D{{Key: "userId", Value: user.ID}})
		if countErr != nil {
			return countErr
		}
		if n > 0 {
			role = RoleScout
		}
	default:
		return err
	}
	_, err = s.collection(usersCollection).UpdateOne(ctx, bson.D{
		{Key: "id", Value: user.ID},
		{Key: "$or", Value: bson.A{
			bson.D{{Key: "role", Value: bson.D{{Key: "$exists", Value: false}}}},
			bson.D{{Key: "role", Value: ""}},
		}},
	}, bson.D{{Key: "$set", Value: bson.D{{Key: "role", Value: role}}}})
	if err != nil {
		return err
	}
	user.Role = role
	return nil
}

func (s *Store) collection(name string) *mongo.Collection {
	return s.client.Database(s.db).Collection(name)
}

const userSearchLimit = 200

// Users returns accounts by id; missing ids are left out.
func (s *Store) Users(ctx context.Context, ids []string) (map[string]User, error) {
	users := make(map[string]User, len(ids))
	if len(ids) == 0 {
		return users, nil
	}
	cursor, err := s.collection(usersCollection).Find(ctx, bson.D{{Key: "id", Value: bson.D{{Key: "$in", Value: ids}}}},
		options.Find().SetProjection(bson.D{{Key: "id", Value: 1}, {Key: "name", Value: 1}, {Key: "email", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	for cursor.Next(ctx) {
		var doc storedUser
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		users[doc.ID] = User{ID: doc.ID, Name: doc.Name, Email: doc.Email}
	}
	return users, cursor.Err()
}

// SearchUserIDs finds account ids whose name or email contains query.
func (s *Store) SearchUserIDs(ctx context.Context, query string) ([]string, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return nil, nil
	}
	pattern := bson.D{{Key: "$regex", Value: regexp.QuoteMeta(query)}, {Key: "$options", Value: "i"}}
	cursor, err := s.collection(usersCollection).Find(ctx, bson.D{{Key: "$or", Value: bson.A{
		bson.D{{Key: "name", Value: pattern}},
		bson.D{{Key: "email", Value: pattern}},
	}}}, options.Find().SetLimit(userSearchLimit).SetProjection(bson.D{{Key: "id", Value: 1}}))
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)
	ids := []string{}
	for cursor.Next(ctx) {
		var doc struct {
			ID string `bson:"id"`
		}
		if err := cursor.Decode(&doc); err != nil {
			return nil, err
		}
		ids = append(ids, doc.ID)
	}
	return ids, cursor.Err()
}

// SessionUserID resolves a bearer token to its user id with one lookup, for
// callers that do not need the user's name or company.
func (s *Store) SessionUserID(ctx context.Context, token string, now time.Time) (string, error) {
	if token == "" {
		return "", ErrInvalidLogin
	}
	var record storedSession
	err := s.collection(sessionsCollection).FindOne(ctx, bson.D{{Key: "tokenHash", Value: hashToken(token)}}).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) || (err == nil && !record.ExpiresAt.After(now)) {
		return "", ErrInvalidLogin
	}
	if err != nil {
		return "", err
	}
	return record.UserID, nil
}
