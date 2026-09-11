# Synthetic Vision fixtures

Hand-written `images:annotate` responses. **No real API calls and no real
photographs of anyone's ID were used to produce these**, and none should ever
be added — a fixture corpus is the wrong place for someone's licence.

All sensitive-looking values are documented dummies:

- Card numbers are Luhn-valid but generated, or the published Amex test number
  `378282246310005`. Note the usual `4111111111111111` is unusable here: it has
  only two distinct digits, so the detector's degenerate-sequence guard
  discards it — which is the correct behaviour.
- The SSN is `078-05-1120`, the Woolworth wallet number, invalid by policy.
- The passport MRZ is a `SPECIMEN` line with an all-zero document number.
- Names, addresses and emails are obviously fictional.

`stageB-*.json` are label/logo responses for the escalation path.
