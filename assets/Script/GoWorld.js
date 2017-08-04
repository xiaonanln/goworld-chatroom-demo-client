let GameClient = require("GameClient")

var gameClient

cc.Class({
    extends: cc.Component,

    properties: {
        serverAddr: {
            default: '',
        },
        serverPort: {
            default: '',
        },
    },

    // use this for initialization
    onLoad: function () {
        gameClient = new GameClient()
        gameClient.serverAddr = this.serverAddr
        gameClient.serverPort = this.serverPort
        this.errorLabel = cc.find("ErrorLabel")
        console.log("errorLabel", this.errorLabel, this.errorLabel.enabled)
        this.errorLabel.active = false
        gameClient.onLoad()
    },

    // Add User Scripts Here
    
    onRegister: function() {
        let loginUser = cc.find("loginUser").getComponent("cc.EditBox")
        let loginPwd = cc.find("loginPwd").getComponent("cc.EditBox")
        console.log("注册...", loginUser.string, loginPwd.string )
        
        let account = gameClient.getEntityByType("Account")
        console.log("account", account.toString())
        if (account === null) {
            this.showErrorTip("正在连接服务器，请耐心等待")
        }
        this.showErrorTip("正在连接服务器，请耐心等待")
    }, 
    
    onLogin: function() {
        console.log("登录...")
    }, 
    
    showErrorTip:function(msg) {
        this.errorLabel.getComponent("cc.Label").string = msg
        this.errorLabel.active = true
        this.scheduleOnce(function(){
            this.errorLabel.active = false
        }, 0.5)
    }
    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
