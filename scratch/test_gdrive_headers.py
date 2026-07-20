import urllib.request
import ssl

context = ssl._create_unverified_context()

# Test URL without export=download
url_no_export = 'https://drive.usercontent.com/download?id=1lAYmPAzEBosDxRhDzL0JdkjESQs7S-gW&confirm=t'
# Test URL with confirm=t but doc subdomain
url_doc = 'https://doc-0g-2s-docs.googleusercontent.com/docs/securesc/ha0ro937gcuc7l7deffksulhg5h7mbp1/1234567/1234567/1234567/1lAYmPAzEBosDxRhDzL0JdkjESQs7S-gW?confirm=t'

for name, u in [('No Export', url_no_export)]:
    req = urllib.request.Request(u, method='HEAD')
    try:
        with urllib.request.urlopen(req, context=context) as response:
            print(f"=== {name} ===")
            print("Status:", response.status)
            print("Final URL:", response.geturl())
            print("Headers:")
            print(response.info())
    except Exception as e:
        print(f"Error {name}:", e)
