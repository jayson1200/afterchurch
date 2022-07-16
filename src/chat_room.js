import firebase from "firebase/app";
import "firebase/firestore";
import "./styles/styles-room.css";

//!When testing this. Be sure to wait for sometime beofre adding the second user
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

let audioPlayer = document.getElementById("audio-player");

//Ensures the first postReturnAnswer call is ignored
let isInInit = false;

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
//Switch peer connection to a hashmap for a better time complexity
let peerConnections = [];
let localStream;
let unsubFromOfferListener;

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
    .set({ lastConnected: Date.now() });

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .set({ user_joined: Date.now() });

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("answer-candidates")
    .doc("metadata")
    .set({
      lastConnected: Date.now(),
    });

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("ice-candidates")
    .doc("metadata")
    .set({ user_joined: Date.now() });

  await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("ice-candidates")
    .doc(sessionStorage.getItem("userID"))
    .set({ icecandidates: firebase.firestore.FieldValue.arrayUnion() });

  await negDoc.update({
    quene: firebase.firestore.FieldValue.arrayUnion(
      sessionStorage.getItem("userID")
    ),
  });
}

//Adds a listener to the user's offercandidate doc then sets the remote description to what appears in the document
function listenToOfferCandidates() {
  unsubFromOfferListener = negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("offer-candidates")
    .doc("metadata")
    .onSnapshot(() => {
      if (isInInit) {
        console.log("posting return answer Time: " + Date.now());

        postReturnAnswer();
      }
      isInInit = true;
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
async function waitInQuene() {
  let doc = await negDoc.get();

  if (doc.data()["quene"]["0"] == sessionStorage.getItem("userID")) {
    return true;
  }

  return new Promise((resolve, reject) => {
    let unsubscribe = negDoc.onSnapshot((doc) => {
      if (doc.data()["quene"]["0"] == sessionStorage.getItem("userID")) {
        unsubscribe();
        resolve(true);
      }
    });
  });
}

function waitTwoOrMoreUsers() {
  return new Promise((resolve, reject) => {
    let unsubscribe = negDoc.collection("users").onSnapshot((col) => {
      if (Object.keys(col.docs).length > 2) {
        unsubscribe();
        resolve(true);
      }
    });
  });
}

async function runSignaling() {
  let users = await negDoc.collection("users").get();

  //Eventually I want to allow the moderator/creating speaker to commence signalling to help cut down on reads and writes

  //Adds an offer to all unadded users
  for (let userDoc of users.docs) {
    if (
      isNotAlreadyConnected(userDoc.id) &&
      userDoc.id != sessionStorage.getItem("userID") &&
      userDoc.id != "metadata"
    ) {
      let newPeerConnection = new UserConnection(servers, userDoc.id);

      peerConnections.push(newPeerConnection);

      setStream(peerConnections.length - 1);

      console.log("Time: " + Date.now() + " Connecting to " + userDoc.id);

      //Creates the doc and array field for userA to add their ice-candidates to
      await negDoc
        .collection("users")
        .doc(userDoc.id)
        .collection("ice-candidates")
        .doc(sessionStorage.getItem("userID"))
        .set({ icecandidates: firebase.firestore.FieldValue.arrayUnion() });

      newPeerConnection.userPeerConnection.onicecandidate = async (event) => {
        console.log("Received Ice Candidate");
        if (event.candidate) {
          await negDoc
            .collection("users")
            .doc(userDoc.id)
            .collection("ice-candidates")
            .doc(sessionStorage.getItem("userID"))
            .update({
              icecandidates: firebase.firestore.FieldValue.arrayUnion(
                event.candidate.toJSON()
              ),
            });
        }
      };

      let connOfferDescription =
        await newPeerConnection.userPeerConnection.createOffer();

      await newPeerConnection.userPeerConnection.setLocalDescription(
        new RTCSessionDescription(connOfferDescription)
      );

      let unsubscribeFromAnswer = negDoc
        .collection("users")
        .doc(userDoc.id)
        .collection("answer-candidates")
        .onSnapshot(async () => {
          let doc = await negDoc
            .collection("users")
            .doc(userDoc.id)
            .collection("answer-candidates")
            .doc("answer")
            .get();

          if (doc.exists) {
            //Could probably make peerConnection search more efficient with a map instead of a list, so I don't have to loop through the entire thing
            for (let i = 0; i < peerConnections.length; i++) {
              //user.id could be pointing to the wrong thing
              if (peerConnections[i].getRemoteUserID() == userDoc.id) {
                peerConnections[i].userPeerConnection.setRemoteDescription(
                  new RTCSessionDescription(JSON.parse(doc.data()["answer"]))
                );

                console.log(
                  "Receiving user " +
                    userDoc.id +
                    " connected to " +
                    sessionStorage.getItem("userID") +
                    " sending user"
                );
              }
            }

            unsubscribeFromAnswer();
          }
        });

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

      console.log(
        "Time:" + Date.now() + " Posting offer. user id: " + userDoc.id
      );

      let currCandidateIndex = 0;
      let initCall = false;

      let unsubscribeIceInitiatorListener = negDoc
        .collection("users")
        .doc(userDoc.id)
        .collection("ice-candidates")
        .doc(userDoc.id)
        .onSnapshot((doc) => {
          if (initCall) {
            let candidates = doc.data()["icecandidates"];

            for (
              let i = currCandidateIndex;
              i < Object.keys(candidates).length;
              i++
            ) {
              newPeerConnection.userPeerConnection.addIceCandidate(
                doc.data()["icecandidates"][i.toString()]
              );
              currCandidateIndex++;
            }

            newPeerConnection.userPeerConnection.addIceCandidate(
              doc.data()["icecandidates"][currCandidateIndex.toString()]
            );

            console.log("Added Ice candidate");

            initCall = true;
          }
        });

      newPeerConnection.userPeerConnection.addEventListener(
        "icegatheringstatechange",
        () => {
          if (
            newPeerConnection.userPeerConnection.iceGatheringState == "complete"
          ) {
            unsubscribeIceInitiatorListener();
          }
        }
      );

      await negDoc
        .collection("users")
        .doc(userDoc.id)
        .collection("offer-candidates")
        .doc("metadata")
        .set({
          lastConnected: Date.now(),
        });
    }
  }
}

//Gets the offer in the offercandidates collection, then set it as the remote description
//Creates and answer then adds it to this users answercanditates collection
async function postReturnAnswer() {
  let doc = await negDoc
    .collection("users")
    .doc(sessionStorage.getItem("userID"))
    .collection("offer-candidates")
    .doc("offer")
    .get()
    // This would map the data from the document
    .then(async (doc) => {
      if (doc.exists) {
        let newPeerConnection = new UserConnection(
          servers,
          doc.data()["senderID"]
        );

        await newPeerConnection.userPeerConnection.setRemoteDescription(
          new RTCSessionDescription(JSON.parse(doc.data()["offer"]))
        );

        let connAnswerDescription =
          await newPeerConnection.userPeerConnection.createAnswer();

        await newPeerConnection.userPeerConnection.setLocalDescription(
          new RTCSessionDescription(connAnswerDescription)
        );

        newPeerConnection.userPeerConnection.onicecandidate = async (event) => {
          if (event.candidate) {
            await negDoc
              .collection("users")
              .doc(sessionStorage.getItem("userID"))
              .collection("ice-candidates")
              .doc(sessionStorage.getItem("userID"))
              .set({
                icecandidates: firebase.firestore.FieldValue.arrayUnion(
                  event.candidate.toJSON()
                ),
              });
          }
        };

        let currCandidateIndex = 0;

        let receiverInit = false;

        let unsubscribeIceReceiverListener = negDoc
          .collection("users")
          .doc(newPeerConnection.remoteUserID)
          .collection("ice-candidates")
          .doc(sessionStorage.getItem("userID"))
          .onSnapshot((doc) => {
            if (receiverInit) {
              let candidates = doc.data()["icecandidates"];

              for (
                let i = currCandidateIndex;
                i < Object.keys(candidates).length;
                i++
              ) {
                newPeerConnection.userPeerConnection.addIceCandidate(
                  doc.data()["icecandidates"][i.toString()]
                );
                currCandidateIndex++;
              }

              newPeerConnection.userPeerConnection.addIceCandidate(
                doc.data()["icecandidates"][currCandidateIndex.toString()]
              );

              console.log("Added Ice candidate");
            }

            receiverInit = true;
          });

        newPeerConnection.userPeerConnection.addEventListener(
          "icegatheringstatechange",
          () => {
            if (
              newPeerConnection.userPeerConnection.iceGatheringState ==
              "complete"
            ) {
              unsubscribeIceReceiverListener();
            }
          }
        );

        await negDoc
          .collection("users")
          .doc(sessionStorage.getItem("userID"))
          .collection("answer-candidates")
          .doc("answer")
          .set({
            answer: JSON.stringify(
              newPeerConnection.userPeerConnection.localDescription
            ),
          });

        peerConnections.push(newPeerConnection);
      } else {
        // doc.data() will be undefined in this case
        console.log("No such document!");
      }
    })
    .catch((error) => {
      console.log("Error getting document:", error);
    });
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
  setAudioDevice();
  await addUserToDatabase();
  console.log("added user to database");
  listenToOfferCandidates();
  await waitTwoOrMoreUsers();
  console.log("Minimum users reached");
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
}

//Pushes tracks from local stream to peer connection
//We input localstream to make sure everything is synchronized by being grouped together
function setStream(index) {
  try {
    localStream.getAudioTracks().forEach((track) => {
      peerConnections[index].userPeerConnection.addTrack(track, localStream);
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
    this.userPeerConnection.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        this.remoteStream.addTrack(track);
      });
    };

    audioPlayer.srcObject = this.remoteStream;
  }

  getRemoteUserID() {
    return this.remoteUserID;
  }
}
