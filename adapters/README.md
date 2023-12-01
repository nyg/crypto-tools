- adapter.js: transforms data to make it independent of exchange and ready to be
  used by the "core"
- connection.js / resource.js: closely matches the exchange's API endpoints,
  kepp logic to a mininum: no data transformation, only pagination fetching,
  error handling, etc.
- http-requester.js: used to make HTTP request, handles creation of Request
  object, independent of exchange API
- authenticator.js: used by http-requester.js to authenticate, if necessary, a
  Request, takes a Request as input and returns another Request
