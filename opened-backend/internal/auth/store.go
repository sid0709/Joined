package auth

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

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
}

func NewStore(client *mongo.Client, db, companies string) *Store {
	return &Store{client: client, db: db, companies: companies}
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
	return err
}

func (s *Store) Signup(ctx context.Context, input Signup, now time.Time) (string, Session, error) {
	input, err := normalizeSignup(input)
	if err != nil {
		return "", Session{}, err
	}
	if input.Company != nil && input.Company.ID != "" {
		if _, err := s.companyByID(ctx, input.Company.ID); err != nil {
			return "", Session{}, err
		}
	}

	hash, err := hashPassword(input.Password)
	if err != nil {
		return "", Session{}, err
	}
	userID, err := newPublicID()
	if err != nil {
		return "", Session{}, err
	}
	_, err = s.collection(usersCollection).InsertOne(ctx, storedUser{
		ID:           userID,
		Name:         input.Name,
		Email:        input.Email,
		PasswordHash: hash,
		CreatedAt:    now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return "", Session{}, ErrEmailTaken
	}
	if err != nil {
		return "", Session{}, err
	}

	if input.Company != nil {
		if err := s.attach(ctx, userID, *input.Company, now); err != nil {
			return "", Session{}, err
		}
	}
	return s.issue(ctx, userID, now)
}

func (s *Store) Signin(ctx context.Context, email, password string, now time.Time) (string, Session, error) {
	email = normalizeEmail(email)
	if email == "" || password == "" {
		return "", Session{}, ErrInvalidLogin
	}
	var user storedUser
	err := s.collection(usersCollection).FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) || (err == nil && !checkPassword(user.PasswordHash, password)) {
		return "", Session{}, ErrInvalidLogin
	}
	if err != nil {
		return "", Session{}, err
	}
	return s.issue(ctx, user.ID, now)
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
	if session.Company != nil {
		return Session{}, ErrHasCompany
	}
	choice, err = normalizeCompany(choice)
	if err != nil {
		return Session{}, err
	}
	if choice.ID != "" {
		if _, err := s.companyByID(ctx, choice.ID); err != nil {
			return Session{}, err
		}
	}
	if err := s.attach(ctx, session.User.ID, choice, now); err != nil {
		return Session{}, err
	}
	return s.view(ctx, session.User.ID)
}

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
	_, err = s.collection(sessionsCollection).InsertOne(ctx, storedSession{
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

func (s *Store) attach(ctx context.Context, userID string, choice CompanyChoice, now time.Time) error {
	companyID := choice.ID
	role := roleMember
	if companyID == "" {
		role = roleOwner
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
		})
		if err != nil {
			return err
		}
	}
	_, err := s.collection(membersCollection).InsertOne(ctx, storedMember{
		UserID:    userID,
		CompanyID: companyID,
		Role:      role,
		CreatedAt: now.UTC(),
	})
	if mongo.IsDuplicateKeyError(err) {
		return ErrHasCompany
	}
	return err
}

func (s *Store) view(ctx context.Context, userID string) (Session, error) {
	var user storedUser
	err := s.collection(usersCollection).FindOne(ctx, bson.D{{Key: "id", Value: userID}}).Decode(&user)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return Session{}, ErrNotFound
	}
	if err != nil {
		return Session{}, err
	}
	session := Session{User: User{ID: user.ID, Name: user.Name, Email: user.Email}}

	var member storedMember
	err = s.collection(membersCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&member)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return session, nil
	}
	if err != nil {
		return Session{}, err
	}
	company, err := s.companyByID(ctx, member.CompanyID)
	if err != nil {
		return session, nil
	}
	company.Role = member.Role
	session.Company = &company
	return session, nil
}

func (s *Store) companyByID(ctx context.Context, id string) (Company, error) {
	var doc struct {
		ID   string `bson:"id"`
		Name string `bson:"companyName"`
		URL  string `bson:"companyUrl"`
		Logo string `bson:"companyLogo"`
	}
	err := s.collection(s.companies).FindOne(ctx, bson.D{{Key: "id", Value: id}}).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) || doc.ID == "" {
		return Company{}, ErrNotFound
	}
	if err != nil {
		return Company{}, err
	}
	return Company{ID: doc.ID, Name: doc.Name, URL: doc.URL, Logo: doc.Logo}, nil
}

func (s *Store) collection(name string) *mongo.Collection {
	return s.client.Database(s.db).Collection(name)
}
