// manage interactions with the Twitter API and handle the search logic

// Placeholder for access tokens you obtain via OAuth
const accessToken = 'YOUR_ACCESS_TOKEN';
const tokenType = 'Bearer';

const consumerKey = 'YOUR_CONSUMER_KEY';
const consumerSecret = 'YOUR_CONSUMER_SECRET';

// Construct the authorization URL
const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(consumerKey)}&redirect_uri=${encodeURIComponent('https://<your-extension-id>.chromiumapp.org/')}&scope=tweet.read%20users.read%20bookmark.read&state=state123`;

function authenticate() {
    chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
    }, function(redirectUrl) {
        if (chrome.runtime.lastError || !redirectUrl) {
            console.error(chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Authorization failed.');
            return;
        }
        // Extract the authorization code from the redirect URL
        const urlParams = new URLSearchParams(new URL(redirectUrl).search);
        const authCode = urlParams.get('code');
        console.log('Authorization code:', authCode);

        // Exchange the authorization code for an access token
        exchangeCodeForToken(authCode);
    });
}

function exchangeCodeForToken(code) {
    const tokenRequestData = new URLSearchParams();
    tokenRequestData.append('code', code);
    tokenRequestData.append('client_id', consumerKey);
    tokenRequestData.append('client_secret', consumerSecret);
    tokenRequestData.append('redirect_uri', 'https://<your-extension-id>.chromiumapp.org/');
    tokenRequestData.append('grant_type', 'authorization_code');

    fetch('https://api.twitter.com/oauth2/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenRequestData
    })
    .then(response => response.json())
    .then(data => {
        console.log('Access Token:', data.access_token);
        // Now you can use the access token to make API calls
    })
    .catch(error => console.error('Error fetching access token:', error));
}

// Call authenticate when needed
authenticate();


// Function to fetch bookmarks from Twitter
async function fetchBookmarks() {
    try {
        const response = await fetch('https://api.twitter.com/2/users/YOUR_USER_ID/bookmarks', {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch bookmarks:', error);
        return null;
    }
}

function saveBookmarks(bookmarks) {
    chrome.storage.local.set({bookmarks: bookmarks}, function() {
        console.log('Bookmarks saved locally.');
    });
}

function searchBookmarks(query, callback) {
    chrome.storage.local.get('bookmarks', function(data) {
        const filteredBookmarks = data.bookmarks.filter(bookmark => 
            bookmark.title.toLowerCase().includes(query.toLowerCase())
        );
        callback(filteredBookmarks);
    });
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "fetchBookmarks") {
        fetchBookmarks().then(bookmarks => {
            sendResponse({bookmarks: bookmarks});
        });
        return true; // Indicate that the response will be sent asynchronously
    }
});

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "searchBookmarks") {
        searchBookmarks(request.query, sendResponse);
        return true; // Keeps the message channel open for asynchronous response
    }
});


// Example of a periodic task or additional functionality
// You might want to check for new bookmarks periodically
setInterval(() => {
    console.log("Checking for new bookmarks...");
    // Fetch and process bookmarks
}, 1000 * 60 * 60); // Every hour
