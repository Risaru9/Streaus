import urllib.request

file_id = '1lAYmPAzEBosDxRhDzL0JdkjESQs7S-gW'
url = f'https://lh3.googleusercontent.com/d/{file_id}'
req = urllib.request.Request(url, method='HEAD')
try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Headers:")
        print(response.info())
except Exception as e:
    print("Error:", e)
