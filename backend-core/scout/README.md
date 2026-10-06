# scout

Scout profiles, submissions, earnings, and payouts.

## Non-US payout harness

`TestNonUSPayout` certifies a GB scout with a W-8BEN, a PayPal method in GBP, fake sanction screening (`clear`), and `FakeProvider`. Staff approval records one send. No live Wise, Payoneer, or PayPal call, and `PAYOUT_ALLOW_LIVE` is not required.

```bash
go test ./backend-core/scout/ -run TestNonUSPayout
```
