package employer

// Prepaid interview balance. Purchases are credited in full. Scheduling an
// interview holds the price; a no-show returns it. There is no card charge.
const (
	CurrencyUSD         = "USD"
	PlanPayPerInterview = "Pay per interview"
	InterviewPriceCents = 4_900
	MinPurchaseCents    = 100
	MaxPurchaseCents    = 100_000_000
	publishSkillMinimum = 3
)

const (
	ledgerPurchase  = "purchase"
	ledgerInterview = "interview"
	ledgerRefund    = "refund"
)

// Wallet is the company's remaining purchase balance.
type Wallet struct {
	BalanceCents   int    `json:"balanceCents"`
	PurchasedCents int    `json:"purchasedCents"`
	SpentCents     int    `json:"spentCents"`
	Currency       string `json:"currency"`
}

func emptyWallet() Wallet {
	return Wallet{Currency: CurrencyUSD}
}

func normalizeWallet(wallet Wallet) Wallet {
	if wallet.Currency == "" {
		wallet.Currency = CurrencyUSD
	}
	return wallet
}
