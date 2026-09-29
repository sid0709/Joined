package employer

import (
	"context"
	"errors"

	"github.com/sid0709/OpenSeat/opened-backend/internal/candidate"
	"time"
)

func employerPeopleErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, candidate.ErrNotFound):
		return ErrNotFound
	case errors.Is(err, candidate.ErrInvalidInput):
		return ErrInvalidInput
	default:
		return err
	}
}

func (s *Store) loadCompanyApplicant(ctx context.Context, companyID, applicantID string) (candidate.Application, error) {
	app, err := s.people.ApplicationForCompany(ctx, companyID, applicantID)
	if err != nil {
		return candidate.Application{}, employerPeopleErr(err)
	}
	return app, nil
}

func (s *Store) saveApplicantOffer(ctx context.Context, companyID, applicantID string, offer *candidate.OfferRecord, now time.Time) error {
	_, err := s.people.SetApplicationOffer(ctx, companyID, applicantID, offer, now)
	return employerPeopleErr(err)
}

// RequestOfferApproval stores a light internal approval and marks the offer pending.
func (s *Store) RequestOfferApproval(ctx context.Context, companyID, applicantID string, input ApprovalRequest, now time.Time) (candidate.OfferApproval, error) {
	app, err := s.loadCompanyApplicant(ctx, companyID, applicantID)
	if err != nil {
		return candidate.OfferApproval{}, err
	}
	next, approval, err := requestOfferApproval(app.Offer, input, now)
	if err != nil {
		return candidate.OfferApproval{}, err
	}
	if err := s.saveApplicantOffer(ctx, companyID, applicantID, next, now); err != nil {
		return candidate.OfferApproval{}, err
	}
	return approval, nil
}

// DecideOfferApproval records approved or rejected and updates offer status.
func (s *Store) DecideOfferApproval(ctx context.Context, companyID, applicantID, approvalID, actorID string, input ApprovalDecision, now time.Time) (candidate.OfferApproval, error) {
	app, err := s.loadCompanyApplicant(ctx, companyID, applicantID)
	if err != nil {
		return candidate.OfferApproval{}, err
	}
	next, approval, err := decideOfferApproval(app.Offer, approvalID, input, actorID, now)
	if err != nil {
		return candidate.OfferApproval{}, err
	}
	if err := s.saveApplicantOffer(ctx, companyID, applicantID, next, now); err != nil {
		return candidate.OfferApproval{}, err
	}
	return approval, nil
}

// CreateOfferEsign mints a first-party OpenSeat sign URL and stores it on the offer.
func (s *Store) CreateOfferEsign(ctx context.Context, companyID, applicantID, origin string, input EsignInput, now time.Time) (candidate.OfferEsign, error) {
	app, err := s.loadCompanyApplicant(ctx, companyID, applicantID)
	if err != nil {
		return candidate.OfferEsign{}, err
	}
	next, esign, err := mintOfferEsign(app.Offer, applicantID, origin, input.DocumentTitle, now)
	if err != nil {
		return candidate.OfferEsign{}, err
	}
	if err := s.saveApplicantOffer(ctx, companyID, applicantID, next, now); err != nil {
		return candidate.OfferEsign{}, err
	}
	return esign, nil
}

// CreateHirePacket stores the onboarding handoff checklist on the offer.
func (s *Store) CreateHirePacket(ctx context.Context, companyID, applicantID string, input HirePacketInput, now time.Time) (candidate.HirePacket, error) {
	app, err := s.loadCompanyApplicant(ctx, companyID, applicantID)
	if err != nil {
		return candidate.HirePacket{}, err
	}
	next, packet, err := upsertHirePacket(app.Offer, input, now)
	if err != nil {
		return candidate.HirePacket{}, err
	}
	if err := s.saveApplicantOffer(ctx, companyID, applicantID, next, now); err != nil {
		return candidate.HirePacket{}, err
	}
	return packet, nil
}
