import firebase from "firebase/app";
import "firebase/firestore";
import "./styles/styles-room.css";

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

const rootRef = db.collection("audio-rooms").doc("rooms");

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

let negDoc;
let peerConnections = [];
let localStream;

connectUser();

async function getNegotiationDoc() {
  let rooms = await rootRef.get();
  negDoc =
    rooms.data()["room-names"][sessionStorage.getItem("roomID").toString()][
      "negotiation-room"
    ];
}

async function addUserToDatabase() {
  await getNegotiationDoc();

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .set({ user_joined: Date.now() });

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("offer-candidates")
    .doc("metadata")
    .set({ user_joined: Date.now() });

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .set({ user_joined: Date.now() });

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("answer-candidates")
    .doc("metadata")
    .set({ user_joined: Date.now() });

  await negDoc.update({
    quene: firebase.firestore.FieldValue.arrayUnion(
      sessionStorage.getItem("userID")
    ),
  });
}

async function checkQuene() {
  let queneData = await negDoc.get();

  if (queneData.data()["quene"]["0"] != sessionStorage.getItem("userID")) {
    await waitInQuene();
  }
}

function removeUserFromQuene() {
  negDoc.update({
    quene: firebase.firestore.FieldValue.arrayRemove(
      sessionStorage.getItem("userID")
    ),
  });
}

//Prefroms the action of waiting until it is this user's turn to connect to the other users
function waitInQuene() {
  return new Promise((resolve, reject) => {
    let frontOfLine = false;

    let unsubscribe = negDoc.onSnapshot((doc) => {
      if (doc.data()["quene"]["0"] == sessionStorage.getItem("userID")) {
        frontOfLine = true;
        unsubscribe();
        resolve(true);
      }
    });

    // let checkIfFront = window.setInterval(() => {
    //   if (frontOfLine) {
    //     clearInterval(checkIfFront);
    //     resolve(true);
    //   }
    // }, 500);
  });
}

async function runSignaling() {
  let users = await negDoc.collection("users").get();

  //Eventually I want to allow the moderator/creating speaker to commence signalling to help cut down on reads and writes

  //Adds an offer to all unadded users
  for (let userDoc of users.docs) {
    if (isNotAlreadyConnected(userDoc.id)) {
      let newPeerConnection = new UserConnection(servers, userDoc.id);

      if (
        userDoc.id != sessionStorage.getItem("userID") &&
        userDoc.id != "metadata"
      ) {
        let connOfferDescription =
          await newPeerConnection.userPeerConnection.createOffer();

        await newPeerConnection.userPeerConnection.setLocalDescription(
          connOfferDescription
        );
        console.log(newPeerConnection.userPeerConnection.localDescription);
        await negDoc
          .collection("users")
          .doc(userDoc.id)
          .collection("offer-candidates")
          .doc("offer")
          .set({
            offer: JSON.stringify(
              newPeerConnection.userPeerConnection.localDescription
            ),
            senderID: sessionStorage.getItem("userID"),
          });
      }

      //Get answer asynchronously from the user I just sent an offer

      /*add an onSnapshot listener to the answerCandidates collection of each user
        This said, we shouldn't move on to the next step until this is finished
      */
      // let unsubscribeFromAnswer = negDoc
      //   .collection("users")
      //   .doc(userDoc.id)
      //   .collection("answer-candidates")
      //   .onSnapshot(() => {
      //     for (let i = 0; i < peerConnections.length; i++){
      //       //user.id could be pointing to the wrong thing or could be a memory leak
      //       if (peerConnections[i].getRemoteUserID() == userDoc.id) {
      //         peerConnections[i].userPeerConnection.setRemoteDescription()
      //       }
      //     }
      //   });
    }
  }
}

//Adds a listener to the user's offercandidate doc then sets the remote description to what appears in the document
let unsubscribeFromOffer = negDoc
  .collection("users")
  .doc(sessionStorage.getItem("userID"))
  .collection("offer-candidates")
  .onSnapshot(() => {
    //Problem here: Can't run async function from function that isnt asynchronous
    postReturnAnswer();
  });

async function postReturnAnswer() {
  let doc = await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("offer-candidates")
    .doc("offer")
    .get();

  let newPeerConnection = new UserConnection(
    servers,
    doc.data()["offer"]["senderID"]
  );

  newPeerConnection.userPeerConnection.setRemoteDescription(
    doc.data()["offer"]["offer"]
  );

  let connAnswerDescription =
    await peerConnection.userPeerConnection.createAnswer();

  await peerConnection.userPeerConnection.setLocalDescription(
    connAnswerDescription
  );

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("answer-candidates")
    .add({
      answer: JSON.stringify(
        peerConnection.userPeerConnection.localDescription
      ),
    });

  peerConnections.push(peerConnection);
}

function isNotAlreadyConnected(userID) {
  for (let i = 0; i < peerConnections.length; i++) {
    if (peerConnections[i].getRemoteUserID() == userID) {
      return false;
    }
  }
  return true;
}

async function connectUser() {
  await addUserToDatabase();
  await checkQuene();
  console.log("Done waiting in quene");
  await runSignaling();
}

//Obtains devices from users hardware like the microhpone
//Sets up the remote stream
async function setAudioDevice() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: false,
    audio: true,
  });

  //Pushes tracks from local stream to peer connection
  //We input localstream to make sure everything is synchronized by being grouped together
  try {
    localStream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  } catch (error) {
    alert(
      "You need to allow us to access your microphone to use this application"
    );
    setAudioDevice();
  }
}

class UserConnection {
  constructor(servers, remoteUserID) {
    this.userPeerConnection = new RTCPeerConnection(servers);
    this.remoteStream = new MediaStream();
    this.remoteUserID = remoteUserID;
    this.userIsConnected = false;

    //Here we add our track to the remoteStream from our peer connection
    // this.userPeerConnection.ontrack = (event) => {
    //   event.streams[0].getTracks().forEach((track) => {
    //     this.remoteStream.addTrack(track);
    //   });
    // };
  }

  getRemoteUserID() {
    return this.remoteUserID;
  }
}
