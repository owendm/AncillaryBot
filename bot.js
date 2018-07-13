let Discord = require("discord.js");
let logger = require("winston");
let auth = require("./auth.json");
let config = require("./config.json")
let mysql = require("mysql");
let { exec } = require("child_process");


// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
    colorize: true
});
logger.level = "debug";

// ID mapping for Anonymous channel
let anonIDMap = new Map();
// List of blacklisted members
let blacklist = new Array();

// ID Reset timer
setInterval(resetIDs, 86400000);

// Initialize Discord Bot
let bot = new Discord.Client();
bot.login(auth.token);

// Years map
let yearsMap = new Map();
yearsMap.set("freshman", "437466872447893504");
yearsMap.set("sophomore", "452303996640821248");
yearsMap.set("junior", "452304063304957952");
yearsMap.set("senior", "452304274735497228");
yearsMap.set("alum", "451857408692715552");
yearsMap.set("prospective", "414579254211117057");
yearsMap.set("ts", "452344486098632722");
yearsMap.set("grad", "461818517600206868");


// Init db, handle disconnects
let con;
function handleDisconnect() {
    con = mysql.createConnection({
        host: config.host,
        port: config.port,
        user: auth.dbuser,
        password: auth.dbpassword
    });
    con.connect(function(err) {
        if(err) {
            logger.error('error when connecting to db:', err);
            setTimeout(handleDisconnect, 2000);
        }
        con.query("use discord;", function (err, result) {
            if (err) throw err;
        });
    });

    con.on('error', function(err) {
        logger.error('db error', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST') { 
            handleDisconnect();
        } else {
             throw err;
        }
    });
}
handleDisconnect();


bot.on("ready", function (evt) {
    logger.info("Connected to discord");
    let anonChannel = bot.channels.get("421077888159449088");
});

bot.on("message", message => {
    // Command
    giveAccess(message);
    if(message.content.substring(0, 1) == '>' && !message.author.bot) {
        const cmdAndArgs = message.content.split(" ");
        const cmd = cmdAndArgs[0].substring(1);
        const args = cmdAndArgs;
        args.shift();
        switch(cmd) {
            case "eval":
                if(checkOwner(message)) {
                    const result = eval(args.join(" "));
                    if(result) {
                        message.channel.send(result);
                    }
                }
                break;
            case "dbexec":
                if(checkOwner(message)) {
                    dbexec(args.join(" "), message.channel, true); 
                }
                break;
            case "exec":
                execCode(message.author, args);
                break;
            case "anon":
                anon(message);
                break;
            case "botsay":
                botsay(message);
                break;
            case "reid":
                reID(message.author);
                break;
            case "message":
                anonMessage(message);
                break;
            case "makeWelcomeEmbed":
                makeWelcomeEmbed(message.channel);
                break;
            case "blacklist":
                if(checkOwner(message)) {
                    blackList(args[0]);
                }
                break;
            case "mute":
                mute(args[0], args[1]);
                break;
         }
    } else if(message.channel.id == 452271450653720588 && !message.author.bot) {
        assignYear(message);
    }

});

bot.on("guildMemberAdd", function (member) {
    welcome(member);
});

function mute(user, time) {
    // TODO: Implement this.
}

function welcome(member) {
    member.addRole("452308369961648128");
    let welcomeChannel = bot.channels.get("452271450653720588"); // Welcome channel ID
    welcomeChannel.send("Welcome to the server " + member + "! Please follow the Instructions above!")
        .then(function(message) {
            message.delete(1800000);
        });
}

function makeWelcomeEmbed(channel) {
    if(checkOwner) {
        let joinEmbed = new Discord.RichEmbed();
        joinEmbed.setTitle("Welcome to the UW Discord!");
        joinEmbed.setColor("#53ff1a");
        joinEmbed.addField("Instructions", "Please do the following to gain access to the server");
        joinEmbed.addField("Step 1", "Read the rules in the #rules channel.")
        joinEmbed.addField("Step 2", "What's your year? Type your year to set it. " + 
            "Possible answers are: " +
            "Freshman, Sophomore, Junior, Senior, Grad, Alum, TS, and Prospective.");
        joinEmbed.addField("Step 3", "Introduce yourself in the #introduce-yourself channel, which you will" +
            " have access to after you complete Step 1 and 2. Once you do this you'll have access to the server!");
        channel.send(joinEmbed);
    }
}

function execCode(author) {
    if(checkOwner(message)) {
        exec(args.toString(), (err, stdout, stderr) => {
            if (err) {
                return;
            }
            if(stdout) {
                message.channel.send(stdout);
            }
        });
    }
}

function assignYear(message) {
    let year = message.content;
    year = year.toLowerCase();
    message.delete();
    if(yearsMap.has(year)) {
        message.member.addRole(yearsMap.get(year));
        message.channel.send("Thanks for adding your year! You can now introduce yourself" +
            " in the #introduce-yourself channel.")
            .then(function(message) {
                message.delete(10000);
            });
    } else {
        message.channel.send("Please enter in a valid year from the possible years: " +
            "Freshman, Sophomore, Junior, Senior, Grad, Alum, TS, and Prospective")
            .then(function(message) {
                message.delete(10000);
            });
    }
}

function giveAccess(message) {
    if(message.member && message.member.roles.has("452308369961648128") &&
        message.channel.id == 452302353559977984) {
            message.member.removeRole("452308369961648128");
            message.member.addRole("452272203078172692");
            const generalChannel = bot.channels.get("362689877751627777");
            generalChannel.send("Welcome to the server " + message.member + "!");
    }
}

function botsay(message) {
    let content = message.content.substring(message.content.indexOf(" "));
    let channel = message.channel;
    channel.send(content);
    if(message.channel.type != "dm") {
        message.delete();
    }
}

function anon(message) {
    let content = message.content.substring(message.content.indexOf(" "));
    let anonChannel = bot.channels.get("421077888159449088");
    if(!anonIDMap.has(message.author)) {
        reID(message.author);
    }
    content = "`" + anonIDMap.get(message.author) + "` " + content;
    if(!blacklist.includes(message.author)) {
        anonChannel.send(content);
    }
    if(message.channel.type != "dm") {
        message.delete();
    }
}

function reID(author) {
    if(anonIDMap.has(author)) {
        let oldID = anonIDMap.get(author);
        anonIDMap.delete(oldID);
        anonIDMap.delete(author);
    }
    let id = Math.floor(Math.random() * 1000);
    while(anonIDMap.has(id)) {
        id = Math.floor(Math.random() * 1000);
    }
    anonIDMap.set(author, id);
    anonIDMap.set(id, author);
    author.send("You are now sending messages under the ID: `" + id + "`");
}

function resetIDs() {
    let anonChannel = bot.channels.get("421077888159449088");
    anonChannel.send("`Resetting IDs`");
    anonIDMap.clear();
    blacklist = new Array();
}

function anonMessage(message) {
    let stripped = message.content.substring(message.content.indexOf(" ") + 1);
    let targetID = parseInt(stripped);
    let content = stripped.substring(stripped.indexOf(" ") + 1);
    if(anonIDMap.has(targetID)) {
        if(!anonIDMap.has(message.author)) {
            reID(message.author);
        }
        let target = anonIDMap.get(targetID);
        target.send("`" + anonIDMap.get(message.author) + "` " + content);
        message.author.send("`Message sent`");
    } else {
        message.author.send("`Error: I couldn't find a user with that ID`");
    }
}

function blackList(id) {
    const author = anonIDMap.get(parseInt(id));
    blacklist.push(author);
}

function dbexec(message, channel, output) {
    con.query(message, function (err, result) {
        if (err) {
            logger.error(err);
        } else if(output) {
            let res = JSON.stringify(result).split("},{");
            for(let i = 0; i < res.length; i++) {
                channel.send("`" + res[i].replace("[{","").replace("}]","") + "`");
            }
        } else {
            channel.send("Success!");
        }
    });
}

/**
 * Checks if the author of the message is the owner of the bot
 * @Param message the message sent
 * @Returns true if the uthor of the message is the owner of the bot
 */
function checkOwner(message) {
    return message.author.id == "117154757818187783";
}



