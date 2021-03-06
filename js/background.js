console.log("Loaded event page");
console.log("Adding onInstalled listener");
chrome.runtime.onInstalled.addListener(function () {
    console.log("Registered alarm");
    chrome.alarms.create("notification", {
        periodInMinutes: 5
    });
});
console.log("Adding alarm listener");
chrome.alarms.onAlarm.addListener(onAlarm);
console.log("Adding notification listener");
chrome.notifications.onClicked.addListener(function () {
    console.log("Notification clicked");
    chrome.tabs.create({ url: "https://lms.lausd.net/home/notifications" }, null);
    chrome.browserAction.setBadgeText({ text: "" });
});
chrome.browserAction.setBadgeBackgroundColor({ color: [217, 0, 0, 255] });
console.log("Adding browser action listener");
chrome.browserAction.onClicked.addListener(function () {
    console.log("Browser action clicked");
    chrome.browserAction.getBadgeText({}, x => {
        console.log("Callback");
        console.log(x);
        let n = Number.parseInt(x);
        if (n) chrome.tabs.create({ url: "https://lms.lausd.net/home/notifications" }, null);
        else chrome.tabs.create({ url: "https://lms.lausd.net" }, null);
        chrome.browserAction.setBadgeText({ text: "" });
    });
});

function onAlarm(alarm) {
    chrome.storage.sync.get(null, function (value) {
        if (alarm && alarm.name === "notification" && value.notifications != "disabled") {
            try {
                console.log(`[${new Date()}] Checking for new notifications`);
                fetch("https://lms.lausd.net/home/notifications?filter=all", {
                    credentials: "same-origin"
                }).then(function (response) {
                    if (response.ok) {
                        return response.json();
                    }
                    throw new Error("Error loading notifications: " + response);
                }).then(function (response) {
                    console.log("Last new grade: " + new Date(value.lastTime).toString());
                    let time = value.lastTime;
                    let timeModified = false;
                    if (!time) {
                        time = Date.now();
                        timeModified = true;
                    }
                    let div = document.querySelector("div") || document.body.appendChild(document.createElement("div"));
                    div.innerHTML = response.output;
                    let notifications = div.querySelectorAll(".edge-sentence");
                    let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    let totalAssignments = 0;
                    for (let notification of Array.from(notifications).reverse()) {
                        if (notification.textContent.includes("new grade")) {
                            let assignments = notification.getElementsByTagName("a");
                            let extraTextElement = notification.querySelector(".other-items-link");
                            let timeText = notification.querySelector(".edge-time").textContent;
                            let splitDate = timeText.split(" at ");
                            let monthDay = splitDate[0];
                            let hourMinute = splitDate[1];
                            let now = new Date();
                            let monthDayYear = monthDay + ` ${now.getFullYear()}`;
                            let today = `${months[now.getMonth()]} ${now.getDate()} ${now.getFullYear()}`;
                            let notificationDate = Date.parse(monthDayYear);
                            if (notificationDate > Date.parse(today)) {
                                notificationDate = Date.parse(monthDay + ` ${now.getFullYear() - 1} ${hourMinute}`);
                            } else {
                                notificationDate = Date.parse(`${monthDayYear} ${hourMinute}`);
                            }

                            if (notificationDate > time) {
                                time = notificationDate;
                                timeModified = true;
                                totalAssignments++;
                                console.dir(notification);
                            }
                        }
                    }

                    if (totalAssignments > 0) {
                        console.warn("New notification!");
                        let n = {
                            type: "basic",
                            iconUrl: "imgs/icon@128.png",
                            title: "New grade posted",
                            message: `${totalAssignments} new assignment${totalAssignments === 1 ? " has a grade" : "s have grades"}`,
                            eventTime: Date.now(),
                            isClickable: true
                        };
                        console.dir(n);
                        if (!value.notifications || value.notifications == "enabled" || value.notifications == "badge") {
                            chrome.browserAction.getBadgeText({}, x => {
                                let num = Number.parseInt(x);
                                chrome.browserAction.setBadgeText({ text: (num ? num + totalAssignments : totalAssignments).toString() });
                            });
                        } else {
                            console.log("Number badge is disabled");
                        }
                        if (!value.notifications || value.notifications == "enabled" || value.notifications == "popup") {
                            chrome.notifications.create("gradeNotification", n, null);
                        } else {
                            console.log("Popup notifications are disabled");
                        }
                    }

                    if (timeModified) {
                        chrome.storage.sync.set({ lastTime: time }, () => { console.log("Set new time " + new Date(time)) });
                    } else {
                        console.log("No new notifications");
                    }

                });
            } catch (error) {
                console.error(error);
            }
        }
        else if (value.notifications === "disabled") {
            console.log("Notifications are disabled");
        }
    });
}