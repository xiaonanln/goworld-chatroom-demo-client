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
        let loginUser = cc.find("loginUser").getComponent("cc.EditBox").string
        let loginPwd = cc.find("loginPwd").getComponent("cc.EditBox").string
        console.log("注册...", loginUser, loginPwd )
        
        let account = gameClient.getEntityByType("Account")
        console.log("account", account.toString())
        if (account === null) {
            this.showErrorTip("正在连接服务器，请耐心等待")
            return 
        }
        
        if (loginUser == "" || loginPwd == "") {
            this.showErrorTip("请输入用户名和密码！")
            return 
        }
        
        account.callServer("Register", loginUser, loginPwd)
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
