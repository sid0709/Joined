package candidate

import (
	"fmt"
	"math"
	"strings"
)

func FromSearchJob(id, title, company, companyID, location, workplace, source string, min, max int, currency, period string) Listing {
	return Listing{
		ID:        id,
		Title:     title,
		Company:   company,
		CompanyID: companyID,
		Location:  formatListingLocation(location, workplace),
		Salary:    formatPay(min, max, currency, period),
		Source:    applicationSource(source),
	}
}

func applicationSource(source string) string {
	if source == SourceDirect {
		return SourceDirect
	}
	return SourceScouted
}

func workplaceLabel(workplace string) string {
	switch workplace {
	case "remote":
		return "Remote"
	case "hybrid":
		return "Hybrid"
	case "onsite":
		return "On-site"
	default:
		return ""
	}
}

func formatListingLocation(location, workplace string) string {
	label := workplaceLabel(workplace)
	location = strings.TrimSpace(location)
	if location == "" {
		if label == "" {
			return "—"
		}
		return label
	}
	if label == "" || strings.EqualFold(location, label) {
		return location
	}
	return location + " · " + label
}

func formatPay(min, max int, currency, period string) string {
	if min <= 0 && max <= 0 {
		return "—"
	}
	if max < min {
		max = min
	}
	if currency == "" {
		currency = DefaultCurrency
	}
	left := formatAmount(min, currency, period)
	right := formatAmount(max, currency, period)
	if period == "hour" {
		return fmt.Sprintf("%s–%s/hr", left, right)
	}
	return left + " – " + right
}

func formatAmount(amount int, currency, period string) string {
	symbol := currencySymbol(currency)
	if period == "hour" {
		return fmt.Sprintf("%s%d", symbol, amount)
	}
	thousands := int(math.Round(float64(amount) / 1000))
	return fmt.Sprintf("%s%dk", symbol, thousands)
}

func currencySymbol(currency string) string {
	switch strings.ToUpper(currency) {
	case "USD", "":
		return "$"
	case "EUR":
		return "€"
	case "GBP":
		return "£"
	default:
		return currency + " "
	}
}
