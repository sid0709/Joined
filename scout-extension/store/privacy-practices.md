# Privacy practices answers

Answers for the Chrome Web Store privacy questionnaire. This is listing material, not a public privacy policy.

## Does this extension collect or use user data?

Yes. Only what the side panel needs to know whether the scout is signed in and to show that account.

## Data types

| Type                                | Used? | Why                                                       |
| ----------------------------------- | ----- | --------------------------------------------------------- |
| Personally identifiable information | Yes   | Display name and email from `GET /v1/scout/me`            |
| Health information                  | No    |                                                           |
| Financial and payment information   | No    | Earnings and payouts stay on the Scoutwell website        |
| Authentication information          | Yes   | Scoutwell session cookie, used only to call the Scout API |
| Personal communications             | No    |                                                           |
| Location                            | No    |                                                           |
| Web history                         | No    |                                                           |
| User activity                       | No    | The panel does not log browsing                           |
| Website content                     | No    | This build does not scrape page HTML                      |

## Certification

- The extension does **not** sell user data.
- User data is used only for the single purpose above.
- User data is transferred only to Joined's first-party Scoutwell hosts (the website origin and the Scout API). No other third party receives it from the extension.
- The extension does **not** use remote code. The store zip is the complete Manifest V3 package.
- Collection is limited to the signed-in scout's session and profile. There is no advertising identifier, no unrelated analytics SDK, and no transfer for credit scoring.
