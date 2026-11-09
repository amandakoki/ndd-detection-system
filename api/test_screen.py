import requests

BASE = "http://127.0.0.1:8000"
LOGIN_URL = BASE + "/api/login/"
CREDS = {"email": "YOUR_EDUCATOR_EMAIL", "password": "YOUR_PASSWORD"}  # use "username" instead of "email" if that's what your login takes
LEARNER_ID = 1  # id of one of this educator's learners (check Django admin)

login = requests.post(LOGIN_URL, json=CREDS)
print("LOGIN:", login.status_code, login.text)

data = login.json()
token = data.get("access") or data.get("token") or (data.get("tokens") or {}).get("access")
if not token:
    raise SystemExit("No access token found in the login response above.")

levels = [{"clicks": 7, "hits": 6, "misses": 1}] * 6 + [{"clicks": 8, "hits": 4, "misses": 4}] * 6
r = requests.post(
    BASE + "/api/ml/screen/",
    headers={"Authorization": f"Bearer {token}"},
    json={"learner_id": LEARNER_ID, "age": 9, "levels": levels},
)
print("SCREEN:", r.status_code, r.text)