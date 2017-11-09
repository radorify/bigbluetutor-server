const winston = require("winston");
const dotenv = require("dotenv");
const config = dotenv.config().parsed;

winston.level = config.LOG_LEVEL;

var deepstreamClient;

function getUserDataError(profile, user, auth)
{
  //Check for errors getting the records, or if a user already exists
  if(!profile)
  {
    winston.error("Error getting the profile record");
    return "An error occurred. Please try again";
  }
  if(profile.username)
  {
    winston.error("Profile record with matching username already exists");
    return "This username is already in use"
  }
  if(!user)
  {
    winston.error("Error getting the user record");
    return "An error occurred. Please try again"
  }
  if(user.username)
  {
    winston.error("User record with matching username already exists");
    return "This username is already in use"
  }
  if(!auth)
  {
    winston.error("Error getting the auth record");
    return "An error occurred. Please try again"
  }
  if(auth.username)
  {
    winston.error("Auth record with matching username already exists");
    return "This username is already in use"
  }
  return null;
}

function isValidUsername(username)
{
  var a = "a".charCodeAt(0);
  var z = "z".charCodeAt(0);
  var zero = "0".charCodeAt(0);
  var nine = "9".charCodeAt(0);
  var space = " ".charCodeAt(0);
  for(var i = 0; i < username.length; ++i)
  {
    var c = username.charCodeAt(i);
    if(!((c >= a && c <= z) || (c >= zero && c <= nine) || c === space))
    {
      return false;
    }
  }
  return true;
}

function createUser(data, response)
{
  // winston.debug("Creating user");
  // winston.debug(data);

  var googleID = data.googleID;
  var username = data.username;

  //No ID or username provided, so do nothing
  if(!data || !data.googleID || data.googleID === "")
  {
    winston.error("No Google ID provided");
    response.send({username: undefined, error: "No Google ID provided"});
    return;
  }
  if(!data.username || data.username === "")
  {
    winston.error("Invalid username");
    response.send({username: undefined, error: "Please enter a username"});
    return;
  }

  username = username.trim().toLowerCase();

  if(!isValidUsername(username))
  {
    winston.error("Invalid username");
    response.send({username: undefined, error: "Usernames may only contain letters, digits and spaces"});
    return;
  }

  //Do not create a new user if a profile record with the given username already exists
  deepstreamClient.record.has("profile/" + username, (error, hasRecord) =>
  {
    if(error)
    {
      winston.error(error);
      response.send({username: undefined, error: "An error occurred. Please try again"});
      return;
    }
    if(hasRecord)
    {
      //Profile with given username already exists, so do nothing
      winston.error("Profile with username", username, "already exists");
      response.send({username: undefined, error: "This username is already in use"});
      return;
    }

    //Do not create a new user if a user record with the given username already exists
    deepstreamClient.record.has("user/" + username, (error, hasRecord) =>
    {
      if(error)
      {
        winston.error(error);
        response.send({username: undefined, error: "An error occurred. Please try again"});
        return;
      }
      if(hasRecord)
      {
        //User with given username already exists, so do nothing
        winston.error("User with username", username, "already exists");
        response.send({username: undefined, error: "This username is already in use"});
        return;
      }

      deepstreamClient.record.has("auth/" + username, (error, hasRecord) =>
      {
        if(error)
        {
            winston.error(error);
            response.send({username: undefined, error: "An error occurred. Please try again"});
            return;
        }
        if(hasRecord)
        {
            winston.error("Auth record with username", username, "already exists");
            response.send({username: undefined, error: "This username is already in use"});
            return;
        }

        deepstreamClient.record.getRecord("profile/" + username).whenReady(profileRecord =>
        {
          deepstreamClient.record.getRecord("user/" + username).whenReady(userRecord =>
          {
            deepstreamClient.record.getRecord("auth/" + username).whenReady(authRecord =>
            {
              var profile = profileRecord.get();
              var user = userRecord.get();
              var auth = authRecord.get();

              var userError = getUserDataError(profile, user, auth);
              if(userError)
              {
                response.send({username: undefined, error: userError});
                return;
              }

              //No errors, so create user
              profile =
              {
                username: username,
                onboardingComplete: false,
                stars: [],
                pendingMeetings: [],
                requestMeetings: [],
                deviceTokens: [],
                messages: {},
                meeting: ""
              };
              profileRecord.set(profile);

              user =
              {
                username: username,
                profilePic: "http://www.freeiconspng.com/uploads/msn-people-person-profile-user-icon--icon-search-engine-16.png",
                position: 'no position',
                description: '',
                ratings: {},
                tutor: false,
              };
              userRecord.set(user);

              auth =
              {
                username: username,
                googleID: googleID
              };
              authRecord.set(auth);

              response.send({username: username});
            }); //Get auth
          }); //Get user
        }); //Get profile

      }); //Has auth
    }); //Has user
  }); //Has profile
}

module.exports = function(dsClient)
{
  deepstreamClient = dsClient;
  return {createUser: createUser};
};
