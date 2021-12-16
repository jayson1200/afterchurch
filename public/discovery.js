import firebase from "firebase/app";
import "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAEsNo8T2XQjf0o1z4zoXmz4F0wrBSImSc",

  authDomain: "afterchurch-4bd87.firebaseapp.com",

  projectId: "afterchurch-4bd87",

  storageBucket: "afterchurch-4bd87.appspot.com",

  messagingSenderId: "945949941572",

  appId: "1:945949941572:web:93cc74360b0192303f8111",

  measurementId: "G-W78QCBLTSK",
};

firebase.initializeApp(firebaseConfig);

let db = firebase.firestore();

let addEventBTN = document.querySelector(".add-event");
let deleteEventBTN = document.querySelector(".delete-event");

if (sessionStorage.getItem("is-admin") == "false") {
  addEventBTN.remove();
  deleteEventBTN.remove();
}

addEventBTN.onclick = function () {
  console.log("popup");
  //Popup
};

deleteEventBTN.onclick = function () {
  console.log("popup");
  //Popup
};

updateRoomsUI();

function updateRoomsUI() {
  let indexToRoomID = 0;

  db.collection("audio-rooms")
    .doc("rooms")
    .get()
    .then((doc) => {
      if (!doc.empty) {
        let roomData = doc.data()["room-names"];
        for (let infoMap of roomData) {
          new ContentItem(
            infoMap["room-name"],
            infoMap["time-date"],
            indexToRoomID
          );
          indexToRoomID++;
        }
      } else {
        alert("Something just went wrong");
      }
    });
}

class ContentItem {
  constructor(roomName, datetime, roomID) {
    this.roomName = roomName;
    this.datetime = datetime;
    this.roomID = roomID;

    let contentList = document.querySelector(".content-list");

    let contentItem = document.createElement("div");

    contentItem.className = "content-item";

    contentList.appendChild(contentItem);

    contentItem.onclick = () => {
      this.goToRoom();
    };

    let contentItemContent = document.createElement("div");

    contentItemContent.className = "content-item-content";

    contentItem.appendChild(contentItemContent);

    let roomNameText = document.createElement("span");

    roomNameText.className = "room-name-text";

    roomNameText.textContent = roomName;

    contentItemContent.appendChild(roomNameText);

    let timeDate = document.createElement("span");

    timeDate.className = "time-date";

    contentItemContent.appendChild(timeDate);

    timeDate.textContent = datetime;
  }

  goToRoom() {
    sessionStorage.setItem("roomID", this.roomID.toString());
    window.location.href = "chat-room.html";
  }
}
