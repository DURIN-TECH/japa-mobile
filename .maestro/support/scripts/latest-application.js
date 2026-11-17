// ─────────────────────────────────────────────────────────────────────────────
// Maestro runScript (japa#361): the id of EMAIL's newest application for
// COUNTRY / VISA, read from the LOCAL emulators, into output.applicationId.
//
// Why: the self-service journey opens the review screen by its deep link
// (`durintech://self-service/<id>/review`) instead of tapping the hub's
// review button, which could start an AI review. The id of the application
// the flow just created is not on screen, so it is read here.
//
// Only talks to this run's emulators on localhost (AUTH_URL = the Auth
// emulator, API_URL = the Functions emulator's api base; both from the
// runner). The Auth emulator accepts any API key. EMAIL / PASSWORD are the
// emulator-only fixture account.
// ─────────────────────────────────────────────────────────────────────────────

// Maestro's GraalJS runtime provides http, json and output; the flow's env
// values arrive as globals.
/* global http, json, output, AUTH_URL, API_URL, EMAIL, PASSWORD, COUNTRY, VISA */

// Refuse anything but this machine, whatever the env says.
function mustBeLocal(url) {
  if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+(\/|$)/.test(url)) {
    throw new Error('latest-application.js: refusing non-local URL ' + url);
  }
}
mustBeLocal(AUTH_URL);
mustBeLocal(API_URL);

// 1. A token from the Auth emulator (REST, emulator-only path).
var signIn = http.post(
  AUTH_URL +
    '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=e2e-emulator',
  {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      returnSecureToken: true,
    }),
  },
);
var token = json(signIn.body).idToken;
if (!token) throw new Error('Auth emulator sign-in failed: ' + signIn.body);

// 2. The client's applications (GET /applications → { success, data: [...] }).
var res = http.get(API_URL + '/applications', {
  headers: { Authorization: 'Bearer ' + token },
});
var apps = json(res.body).data || [];

// Firestore Timestamps arrive as { _seconds } (or an ISO string).
function seconds(t) {
  if (!t) return 0;
  if (typeof t === 'string') return Date.parse(t) / 1000;
  return t._seconds || t.seconds || 0;
}

var mine = apps
  .filter(function (a) {
    return a.countryCode === COUNTRY && a.visaTypeId === VISA;
  })
  .sort(function (a, b) {
    return seconds(b.createdAt) - seconds(a.createdAt);
  });
if (!mine.length) {
  throw new Error('no ' + COUNTRY + '/' + VISA + ' application for ' + EMAIL);
}
output.applicationId = mine[0].id;
