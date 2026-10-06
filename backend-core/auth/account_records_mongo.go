package auth

import (
	"context"
	"errors"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

type mongoAccountRecords struct {
	store *Store
}

var _ AccountRecords = (*mongoAccountRecords)(nil)

type storedAccountDoc struct {
	ID           string    `bson:"id"`
	Name         string    `bson:"name"`
	Email        string    `bson:"email"`
	Role         string    `bson:"role,omitempty"`
	PasswordHash []byte    `bson:"passwordHash,omitempty"`
	PasswordSalt []byte    `bson:"passwordSalt,omitempty"`
	Verified     bool      `bson:"verified,omitempty"`
	CreatedAt    time.Time `bson:"createdAt"`
	SuspendedAt  time.Time `bson:"suspendedAt,omitempty"`
}

func (m *mongoAccountRecords) InsertUser(ctx context.Context, user AccountUser) error {
	_, err := m.store.collection(usersCollection).InsertOne(ctx, bson.D{
		{Key: "id", Value: user.ID},
		{Key: "name", Value: user.Name},
		{Key: "email", Value: user.Email},
		{Key: "role", Value: user.Role},
		{Key: "passwordHash", Value: user.PasswordHash},
		{Key: "passwordSalt", Value: user.PasswordSalt},
		{Key: "verified", Value: user.Verified},
		{Key: "createdAt", Value: user.CreatedAt.UTC()},
	})
	if mongo.IsDuplicateKeyError(err) {
		return ErrEmailTaken
	}
	return err
}

func (m *mongoAccountRecords) UserByEmail(ctx context.Context, email string) (AccountUser, error) {
	return m.findUser(ctx, bson.D{{Key: "email", Value: email}})
}

func (m *mongoAccountRecords) UserByID(ctx context.Context, id string) (AccountUser, error) {
	return m.findUser(ctx, bson.D{{Key: "id", Value: id}})
}

func (m *mongoAccountRecords) findUser(ctx context.Context, filter bson.D) (AccountUser, error) {
	var doc storedAccountDoc
	err := m.store.collection(usersCollection).FindOne(ctx, filter).Decode(&doc)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return AccountUser{}, ErrNotFound
	}
	if err != nil {
		return AccountUser{}, err
	}
	return AccountUser{
		ID:           doc.ID,
		Name:         doc.Name,
		Email:        doc.Email,
		Role:         doc.Role,
		PasswordHash: doc.PasswordHash,
		PasswordSalt: doc.PasswordSalt,
		Verified:     doc.Verified,
		CreatedAt:    doc.CreatedAt,
		SuspendedAt:  doc.SuspendedAt,
	}, nil
}

func (m *mongoAccountRecords) SetVerified(ctx context.Context, userID string) error {
	result, err := m.store.collection(usersCollection).UpdateOne(
		ctx,
		bson.D{{Key: "id", Value: userID}},
		bson.D{{Key: "$set", Value: bson.D{{Key: "verified", Value: true}}}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (m *mongoAccountRecords) SetPassword(ctx context.Context, email string, hash, salt []byte) error {
	result, err := m.store.collection(usersCollection).UpdateOne(
		ctx,
		bson.D{{Key: "email", Value: email}},
		bson.D{{Key: "$set", Value: bson.D{
			{Key: "passwordHash", Value: hash},
			{Key: "passwordSalt", Value: salt},
		}}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrNotFound
	}
	return nil
}

func (m *mongoAccountRecords) InsertVerification(ctx context.Context, rec VerificationRecord) error {
	_, err := m.store.collection(verificationCollection).InsertOne(ctx, storedVerification{
		UserID:    rec.UserID,
		TokenHash: rec.TokenHash,
		ExpiresAt: rec.ExpiresAt,
		CreatedAt: rec.CreatedAt,
	})
	return err
}

func (m *mongoAccountRecords) TakeVerification(ctx context.Context, tokenHash string) (VerificationRecord, error) {
	var rec storedVerification
	err := m.store.collection(verificationCollection).FindOneAndDelete(
		ctx,
		bson.D{{Key: "tokenHash", Value: tokenHash}},
	).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return VerificationRecord{}, ErrNotFound
	}
	if err != nil {
		return VerificationRecord{}, err
	}
	return VerificationRecord{
		UserID:    rec.UserID,
		TokenHash: rec.TokenHash,
		ExpiresAt: rec.ExpiresAt,
		CreatedAt: rec.CreatedAt,
	}, nil
}

func (m *mongoAccountRecords) DeleteResets(ctx context.Context, email string) error {
	_, err := m.store.collection(resetCollection).DeleteMany(ctx, bson.D{{Key: "email", Value: email}})
	return err
}

func (m *mongoAccountRecords) InsertReset(ctx context.Context, rec ResetRecord) error {
	_, err := m.store.collection(resetCollection).InsertOne(ctx, storedReset{
		Email:     rec.Email,
		TokenHash: rec.TokenHash,
		ExpiresAt: rec.ExpiresAt,
		CreatedAt: rec.CreatedAt,
	})
	return err
}

func (m *mongoAccountRecords) TakeReset(ctx context.Context, tokenHash string) (ResetRecord, error) {
	var rec storedReset
	err := m.store.collection(resetCollection).FindOneAndDelete(
		ctx,
		bson.D{{Key: "tokenHash", Value: tokenHash}},
	).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return ResetRecord{}, ErrNotFound
	}
	if err != nil {
		return ResetRecord{}, err
	}
	return ResetRecord{
		Email:     rec.Email,
		TokenHash: rec.TokenHash,
		ExpiresAt: rec.ExpiresAt,
		CreatedAt: rec.CreatedAt,
	}, nil
}

func (m *mongoAccountRecords) LoginAttempt(ctx context.Context, email string) (LoginAttemptRecord, error) {
	var rec storedLoginAttempt
	err := m.store.collection(loginAttemptsCollection).FindOne(ctx, bson.D{{Key: "email", Value: email}}).Decode(&rec)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return LoginAttemptRecord{}, ErrNotFound
	}
	if err != nil {
		return LoginAttemptRecord{}, err
	}
	return LoginAttemptRecord{
		Email:       rec.Email,
		Attempts:    rec.Attempts,
		LockedUntil: rec.LockedUntil,
		UpdatedAt:   rec.UpdatedAt,
	}, nil
}

func (m *mongoAccountRecords) UpsertLoginAttempt(ctx context.Context, rec LoginAttemptRecord) error {
	_, err := m.store.collection(loginAttemptsCollection).UpdateOne(
		ctx,
		bson.D{{Key: "email", Value: rec.Email}},
		bson.D{{Key: "$set", Value: bson.D{
			{Key: "email", Value: rec.Email},
			{Key: "attempts", Value: rec.Attempts},
			{Key: "lockedUntil", Value: rec.LockedUntil},
			{Key: "updatedAt", Value: rec.UpdatedAt},
		}}},
		options.UpdateOne().SetUpsert(true),
	)
	return err
}

func (m *mongoAccountRecords) DeleteLoginAttempt(ctx context.Context, email string) error {
	_, err := m.store.collection(loginAttemptsCollection).DeleteOne(ctx, bson.D{{Key: "email", Value: email}})
	return err
}

func (m *mongoAccountRecords) InsertSession(ctx context.Context, rec SessionRecord) error {
	_, err := m.store.collection(sessionsCollection).InsertOne(ctx, storedSession{
		TokenHash: rec.TokenHash,
		UserID:    rec.UserID,
		ExpiresAt: rec.ExpiresAt,
		CreatedAt: rec.CreatedAt,
	})
	return err
}

func (m *mongoAccountRecords) DeleteSessionsByUser(ctx context.Context, userID string) error {
	_, err := m.store.collection(sessionsCollection).DeleteMany(ctx, bson.D{{Key: "userId", Value: userID}})
	return err
}

func (m *mongoAccountRecords) SessionByToken(ctx context.Context, tokenHash string) (SessionRecord, error) {
	var record storedSession
	err := m.store.collection(sessionsCollection).FindOne(ctx, bson.D{{Key: "tokenHash", Value: tokenHash}}).Decode(&record)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return SessionRecord{}, ErrNotFound
	}
	if err != nil {
		return SessionRecord{}, err
	}
	return SessionRecord{
		TokenHash: record.TokenHash,
		UserID:    record.UserID,
		ExpiresAt: record.ExpiresAt,
		CreatedAt: record.CreatedAt,
	}, nil
}

func (m *mongoAccountRecords) DeleteUser(ctx context.Context, userID string) error {
	_, err := m.store.collection(usersCollection).DeleteOne(ctx, bson.D{{Key: "id", Value: userID}})
	return err
}

func (m *mongoAccountRecords) CompanyMembership(ctx context.Context, userID string) (*Company, error) {
	var member storedMember
	err := m.store.collection(membersCollection).FindOne(ctx, bson.D{{Key: "userId", Value: userID}}).Decode(&member)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	company, createdBy, err := m.store.companyByID(ctx, member.CompanyID)
	if err != nil {
		return nil, ErrNotFound
	}
	company.Role = member.Role
	company.HiringRole = membershipFrom(member).HiringRole
	company.IsCreator = removesCompany(createdBy, userID)
	return &company, nil
}
