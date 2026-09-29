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
func (s *Store) RequestOfferApproval(ctx context.Context, companyID, applicantID string, input ApprovalRequest, actor Actor, now time.Time) (candidate.OfferApproval, error) {
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
	if err := s.writeAudit(ctx, companyID, actor, AuditEvent{
		Action:      AuditOfferUpdated,
		SubjectType: subjectOffer,
		SubjectID:   applicantID,
		Summary:     "Requested offer approval",
		After:       map[string]any{"status": next.Status},
	}, now); err != nil {
		return candidate.OfferApproval{}, err
	}
	return approval, nil
}

// DecideOfferApproval records approved or rejected and updates offer status.
func (s *Store) DecideOfferApproval(ctx context.Context, companyID, applicantID, approvalID string, input ApprovalDecision, actor Actor, now time.Time) (candidate.OfferApproval, error) {
	app, err := s.loadCompanyApplicant(ctx, companyID, applicantID)
	if err != nil {
		return candidate.OfferApproval{}, err
	}
	next, approval, err := decideOfferApproval(app.Offer, approvalID, input, actor.ID, now)
	if err != nil {
		return candidate.OfferApproval{}, err
	}
	if err := s.saveApplicantOffer(ctx, companyID, applicantID, next, now); err != nil {
		return candidate.OfferApproval{}, err
	}
	action := AuditOfferUpdated
	summary := "Updated offer approval"
	if approval.Status == candidate.OfferApprovalApproved {
		action = AuditOfferApproved
		summary = "Approved offer"
	}
	if err := s.writeAudit(ctx, companyID, actor, AuditEvent{
		Action:      action,
		SubjectType: subjectOffer,
		SubjectID:   applicantID,
		Summary:     summary,
		After:       map[string]any{"status": approval.Status},
	}, now); err != nil {
		return candidate.OfferApproval{}, err
	}
	return approval, nil
}

// CreateOfferEsign mints a first-party OpenSeat sign URL and stores it on the offer.
func (s *Store) CreateOfferEsign(ctx context.Context, companyID, applicantID, origin string, input EsignInput, actor Actor, now time.Time) (candidate.OfferEsign, error) {
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
	if err := s.writeAudit(ctx, companyID, actor, AuditEvent{
		Action:      AuditOfferSent,
		SubjectType: subjectOffer,
		SubjectID:   applicantID,
		Summary:     "Sent offer for signature",
		After:       map[string]any{"status": next.Status},
	}, now); err != nil {
		return candidate.OfferEsign{}, err
	}
	return esign, nil
}

// CreateHirePacket stores the onboarding handoff checklist on the offer.
func (s *Store) CreateHirePacket(ctx context.Context, companyID, applicantID string, input HirePacketInput, actor Actor, now time.Time) (candidate.HirePacket, error) {
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
	if err := s.writeAudit(ctx, companyID, actor, AuditEvent{
		Action:      AuditHireMarked,
		SubjectType: subjectOffer,
		SubjectID:   applicantID,
		Summary:     "Marked hired",
		After:       map[string]any{"hirePacket": packet.Status},
	}, now); err != nil {
		return candidate.HirePacket{}, err
	}
	return packet, nil
}
