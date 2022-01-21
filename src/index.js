/*Importing these files won work without webpack because the browser doesn't 
actually know where thye are unless you would like to find it in the node modules.
 Webpack solves this problem*/

import firebase from "firebase/app";
import "firebase/firestore";
import "./styles/style.css";

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

document.querySelector("#check-btn").onclick = function () {
  store_credentials(go_to_next_page);
};

//Goes to the discovery page 
function go_to_next_page() {
  console.log("running");
  window.location.href = "discovery.html";
}

//Stores the admin-password, first-name, the user's picture, whether the user isAdmin, and last-name in session storage
function store_credentials(func_to_run_after) {
  let docRef = db.collection("admin-password").doc("password-1");

  sessionStorage.setItem(
    "first-name",
    document.querySelector("#first-name-textbox").value
  );

  sessionStorage.setItem(
    "last-name",
    document.querySelector("#last-name-textbox").value
  );

  get_pic_data_url().onload = function () {
    sessionStorage.setItem("picture", this.result);
  };

  docRef.get().then((doc) => {
    if (!doc.empty) {
      sessionStorage.setItem(
        "is-admin",
        doc.data()["word-1"] ==
          document.querySelector("#admin-password-textbox").value
      );
    } else {
      alert("Something just went wrong");
      admin_password = null;
    }
    console.log(generate_random_auth_code());
    sessionStorage.setItem("userID", generate_random_auth_code());

    func_to_run_after();
  });
}

//Gets the picture the user added via the addpic button
function get_pic_data_url() {
  const reader = new FileReader();

  reader.readAsDataURL(document.querySelector(".add-pic-input").files[0]);

  return reader;
}

//Generates the userID for the current user
function generate_random_auth_code() {
  let lower_case_lets = "abcdefghijklmnopqrstuvwxyz";
  let upper_case_lets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let numbers = "0123456789";

  let code = "";
  let chosenList;
  let chosenListVal;

  while (code.length < 11) {
    chosenList = get_rand_int(1, 3);

    if (chosenList == 1) {
      chosenListVal = get_rand_int(0, 25);
      code += lower_case_lets.slice(chosenListVal, chosenListVal + 1);
    } else if (chosenList == 2) {
      chosenListVal = get_rand_int(0, 9);
      code += numbers.slice(chosenListVal, chosenListVal + 1);
    } else if (chosenList == 3) {
      chosenListVal = get_rand_int(0, 25);
      code += upper_case_lets.slice(chosenListVal, chosenListVal + 1);
    }
  }

  return code;
}
//Generates a random number between a min and max (inclusive)
function get_rand_int(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
