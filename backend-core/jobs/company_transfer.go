package jobs

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/sid0709/OpenSeat/backend-core/jobschema"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// companyImportModel marks a company a person published from an import file.
const companyImportModel = "import"

// CompanyTransfer is one staged company in the export file. Every profile field is
// present. An empty value is null, so a person can fill it in and import the file.
type CompanyTransfer struct {
	ID                string            `json:"id"`
	Name              *string           `json:"name"`
	URL               *string           `json:"url"`
	Logo              *string           `json:"logo"`
	Tagline           *string           `json:"tagline"`
	About             *string           `json:"about"`
	Industry          *string           `json:"industry"`
	Size              *string           `json:"size"`
	Founded           *int              `json:"founded"`
	ReplyDays         *int              `json:"replyDays"`
	Headquarters      *string           `json:"headquarters"`
	CompanyType       *string           `json:"companyType"`
	Locations         *string           `json:"locations"`
	Specialties       []string          `json:"specialties"`
	Mission           *string           `json:"mission"`
	Values            []companyValue    `json:"values"`
	BenefitCategories []benefitCategory `json:"benefitCategories"`
}

// CompanyImportResult says how an import file landed. Unmatched ids were valid but
// not in the staged list, so they stayed out of the directory.
type CompanyImportResult struct {
	Published int      `json:"published"`
	Unmatched []string `json:"unmatched"`
}

// ExportStagedCompanies is every company still in staging, busiest first, with empty
// profile fields as null.
func (s *Store) ExportStagedCompanies(ctx context.Context) ([]CompanyTransfer, error) {
	opts := options.Find().SetSort(bson.D{
		{Key: "jobCount", Value: -1},
		{Key: "companyName", Value: 1},
		{Key: "id", Value: 1},
	})
	cursor, err := s.stagedCompanies().Find(ctx, bson.D{}, opts)
	if err != nil {
		return nil, fmt.Errorf("read staged companies: %w", err)
	}
	defer cursor.Close(ctx)

	var docs []storedCompany
	if err := cursor.All(ctx, &docs); err != nil {
		return nil, fmt.Errorf("read staged companies: %w", err)
	}
	out := make([]CompanyTransfer, 0, len(docs))
	for _, doc := range docs {
		if doc.ID == "" {
			continue
		}
		out = append(out, companyTransferFrom(doc))
	}
	return out, nil
}

// ImportStagedCompanies checks the file, then publishes each company whose id is still
// staged. A valid id that is not staged is reported and left alone. One invalid row
// publishes nothing.
func (s *Store) ImportStagedCompanies(ctx context.Context, raw []byte) (CompanyImportResult, error) {
	rows, err := parseCompanyTransfers(raw)
	if err != nil {
		return CompanyImportResult{}, err
	}
	result := CompanyImportResult{Unmatched: []string{}}
	for _, row := range rows {
		published, err := s.importStagedCompany(ctx, row)
		if err != nil {
			return result, err
		}
		if !published {
			result.Unmatched = append(result.Unmatched, row.ID)
			continue
		}
		result.Published++
	}
	return result, nil
}

func (s *Store) importStagedCompany(ctx context.Context, row CompanyTransfer) (bool, error) {
	overrides, err := overridesFrom(row.write())
	if err != nil {
		return false, err
	}
	set := bson.D{
		{Key: "overrides", Value: overrides},
		{Key: researchedAtField, Value: time.Now().UTC()},
		{Key: "research.model", Value: companyImportModel},
		{Key: "research.sources", Value: []string{}},
		{Key: researchFoundField, Value: true},
	}
	var updated bson.D
	err = s.stagedCompanies().FindOneAndUpdate(ctx, bson.D{{Key: "id", Value: row.ID}},
		bson.D{{Key: "$set", Value: set}},
		options.FindOneAndUpdate().SetReturnDocument(options.After)).Decode(&updated)
	if errors.Is(err, mongo.ErrNoDocuments) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("update staged company: %w", err)
	}
	if err := s.publishStaged(ctx, updated); err != nil {
		return false, err
	}
	return true, nil
}

func companyTransferFrom(doc storedCompany) CompanyTransfer {
	company := doc.publicCompany()
	return CompanyTransfer{
		ID:                company.ID,
		Name:              textPtr(company.Name),
		URL:               textPtr(company.URL),
		Logo:              textPtr(company.Logo),
		Tagline:           textPtr(company.Tagline),
		About:             textPtr(company.About),
		Industry:          textPtr(company.Industry),
		Size:              textPtr(company.Size),
		Founded:           countPtr(company.Founded),
		ReplyDays:         countPtr(company.ReplyDays),
		Headquarters:      textPtr(company.Headquarters),
		CompanyType:       textPtr(company.CompanyType),
		Locations:         textPtr(company.Locations),
		Specialties:       nilIfEmpty(company.Specialties),
		Mission:           textPtr(company.Mission),
		Values:            nilValues(company.Values),
		BenefitCategories: nilBenefits(company.BenefitCategories),
	}
}

func (row CompanyTransfer) write() CompanyWrite {
	return CompanyWrite{
		Name:              textOf(row.Name),
		URL:               textOf(row.URL),
		Logo:              textOf(row.Logo),
		Tagline:           textOf(row.Tagline),
		About:             textOf(row.About),
		Industry:          textOf(row.Industry),
		Size:              textOf(row.Size),
		Founded:           countOf(row.Founded),
		ReplyDays:         countOf(row.ReplyDays),
		Headquarters:      textOf(row.Headquarters),
		CompanyType:       textOf(row.CompanyType),
		Locations:         textOf(row.Locations),
		Specialties:       row.Specialties,
		Mission:           textOf(row.Mission),
		Values:            row.Values,
		BenefitCategories: row.BenefitCategories,
	}
}

func parseCompanyTransfers(raw []byte) ([]CompanyTransfer, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || trimmed[0] != '[' {
		return nil, fmt.Errorf("%w: expected a JSON array of companies", ErrInvalidInput)
	}
	dec := json.NewDecoder(bytes.NewReader(trimmed))
	dec.DisallowUnknownFields()
	var rows []CompanyTransfer
	if err := dec.Decode(&rows); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrInvalidInput, err.Error())
	}
	var extra json.RawMessage
	if err := dec.Decode(&extra); !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("%w: expected one JSON array", ErrInvalidInput)
	}
	if err := validateCompanyTransfers(rows); err != nil {
		return nil, err
	}
	return rows, nil
}

func validateCompanyTransfers(rows []CompanyTransfer) error {
	if len(rows) == 0 {
		return fmt.Errorf("%w: the file has no companies", ErrInvalidInput)
	}
	seen := map[string]int{}
	var problems []string
	for i, row := range rows {
		if err := validateCompanyTransfer(row); err != nil {
			problems = append(problems, fmt.Sprintf("row %d: %s", i+1, err.Error()))
			continue
		}
		if first, ok := seen[row.ID]; ok {
			problems = append(problems, fmt.Sprintf("row %d: id %s is already on row %d", i+1, row.ID, first))
			continue
		}
		seen[row.ID] = i + 1
	}
	if len(problems) == 0 {
		return nil
	}
	if len(problems) > 8 {
		extra := len(problems) - 8
		problems = append(problems[:8], fmt.Sprintf("%d more", extra))
	}
	return fmt.Errorf("%w: %s", ErrInvalidInput, strings.Join(problems, "; "))
}

func validateCompanyTransfer(row CompanyTransfer) error {
	if !isPublicID(row.ID) {
		return errors.New("id is not a company id")
	}
	write := row.write()
	if write.Name == "" {
		return errors.New("name is required")
	}
	if write.URL != "" && !validLink(write.URL, maxCompanyURL) {
		return errors.New("url is not a link")
	}
	if write.Logo != "" && !validLink(write.Logo, maxCompanyLogo) {
		return errors.New("logo is not a link")
	}
	if write.Size != "" {
		if _, ok := jobschema.CanonicalChoice(write.Size, jobschema.CompanySizes()); !ok {
			return errors.New("size is not a listed company size")
		}
	}
	if write.Founded != 0 && (write.Founded < minFoundedYear || write.Founded > maxFoundedYear) {
		return errors.New("founded is out of range")
	}
	if write.ReplyDays < 0 || write.ReplyDays > maxReplyDays {
		return errors.New("replyDays is out of range")
	}
	if _, err := overridesFrom(write); err != nil {
		return errors.New("company fields are not valid")
	}
	return nil
}

func textPtr(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func countPtr(value int) *int {
	if value == 0 {
		return nil
	}
	return &value
}

func textOf(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func countOf(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}
