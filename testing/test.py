import requests
import base64
import threading
import time

URL = "http://localhost:8000/api/users/authenticate"
USERNAME = "chandra"
PASSWORD = "123"

# Encode Basic Auth
credentials = f"{USERNAME}:{PASSWORD}"
encoded_credentials = base64.b64encode(credentials.encode()).decode()

headers = {
    "Authorization": f"Basic {encoded_credentials}"
}

success = 0
rate_limited = 0
other_errors = 0

lock = threading.Lock()

def hit_endpoint(i):
    global success, rate_limited, other_errors

    try:
        response = requests.get(URL, headers=headers)

        with lock:
            if response.status_code == 200:
                success += 1
                print(f"[{i}] ✅ 200 OK")
            elif response.status_code == 429:
                rate_limited += 1
                print(f"[{i}] ❌ 429 Too Many Requests")
            else:
                other_errors += 1
                print(f"[{i}] ⚠️ {response.status_code}")

    except Exception as e:
        print(f"[{i}] ERROR: {e}")

def rate_limiter_test(total_requests=20):
    threads = []

    start = time.time()

    for i in range(total_requests):
        t = threading.Thread(target=hit_endpoint, args=(i,))
        threads.append(t)
        t.start()

    for t in threads:
        t.join()

    duration = time.time() - start

    print("\n===== RESULTS =====")
    print(f"Total Time: {duration:.2f}s")
    print(f"Success: {success}")
    print(f"Rate Limited: {rate_limited}")
    print(f"Other Errors: {other_errors}")

if __name__ == "__main__":
    rate_limiter_test(100)
