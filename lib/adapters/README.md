From top to bottom (App -> External API):

- adapter.js: transforms data to make it independent of exchange and ready to be
  used by the "core"
- resource.js: closely matches the exchange's API endpoints, keep logic to a
  mininum: no data transformation, only pagination fetching, error handling,
  etc.
- http-requester.js: used to make HTTP request, handles creation of Request
  object, independent of exchange API
- authenticator.js: used by http-requester.js to authenticate, if required, a
  Request; it takes a Request as input and returns another Request
