package scout

import (
	"fmt"

	"github.com/sid0709/OpenSeat/backend-core/jobs"
	"github.com/sid0709/OpenSeat/backend-core/jobschema"
)

func canonicalPay(pay Pay, salary string) Pay {
	if pay.Min == 0 && pay.Max == 0 {
		if parsed, ok := jobs.ParsePayText(salary); ok {
			pay = Pay{Min: parsed.Min, Max: parsed.Max, Currency: parsed.Currency, Period: parsed.Period}
		}
	}
	if len(pay.Currency) != 3 {
		pay.Currency = jobschema.CurrencyUSD
	}
	if pay.Period != jobschema.PayHour {
		pay.Period = jobschema.PayYear
	}
	if pay.Min < 0 {
		pay.Min = 0
	}
	if pay.Max < 0 {
		pay.Max = 0
	}
	return pay
}

func salaryLabel(pay Pay) string {
	if pay.Min == 0 && pay.Max == 0 {
		return ""
	}
	period := "a year"
	if pay.Period == jobschema.PayHour {
		period = "an hour"
	}
	return fmt.Sprintf("%s – %s %s", payAmount(pay.Min), payAmount(pay.Max), period)
}

func payAmount(value int) string {
	if value >= 1000 && value%1000 == 0 {
		return fmt.Sprintf("$%dk", value/1000)
	}
	return fmt.Sprintf("$%d", value)
}
