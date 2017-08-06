let GameClient = require("GameClient")

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
        if (!cc.gameClient) {
            cc.gameClient = new GameClient()
            cc.gameClient.serverAddr = this.serverAddr
            cc.gameClient.serverPort = this.serverPort
            cc.gameClient.onLoad()
        }

        this.errorLabel = cc.find("ErrorLabel")
        console.log("errorLabel", this.errorLabel, this.errorLabel.enabled)
        this.errorLabel.active = false
        this.chatItems = new Array()
    },

    // Add User Scripts Here
    
    onRegister: function() {
        let loginUser = cc.find("loginUser").getComponent("cc.EditBox").string
        let loginPwd = cc.find("loginPwd").getComponent("cc.EditBox").string
        console.log("注册...", loginUser, loginPwd )
        
        let account = cc.gameClient.getEntityByType("Account")
        console.log("account", account !== null ? account.toString():null)
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
        let loginUser = cc.find("loginUser").getComponent("cc.EditBox").string
        let loginPwd = cc.find("loginPwd").getComponent("cc.EditBox").string
        console.log("登录...", loginUser, loginPwd )

        let account = cc.gameClient.getEntityByType("Account")
        console.log("account", account !== null ? account.toString():null)
        if (account === null) {
            this.showErrorTip("正在连接服务器，请耐心等待")
            return 
        }
        
        if (loginUser == "" || loginPwd == "") {
            this.showErrorTip("请输入用户名和密码！")
            return 
        }

        account.callServer("Login", loginUser, loginPwd)
    }, 
        
    onSendChat: function() {
        let inputText = cc.find("/OutterLayout/BottomLayout/InputBox").getComponent("cc.EditBox").string
        console.log("发送", inputText)
        cc.gameClient.player.callServer("SendChat", inputText)
    },
    
    showErrorTip: function(msg) {
        this.errorLabel.getComponent("cc.Label").string = msg
        this.errorLabel.active = true
        this.scheduleOnce(function(){
            this.errorLabel.active = false
        }, 0.5)
    },

    onAvatarLoginSuccess: function() {
        console.log("玩家登录成功！")
        cc.director.loadScene("chat");
    },

    onRecvChat: function(name, text) {
        console.log(name+" 说：" + text)
        // let label = new cc.LabelTTF('label text',  'Times New Roman', 32, cc.size(320,32), cc.TEXT_ALIGNMENT_LEFT)
        let labelNode = new cc.Node()
        labelNode.setAnchorPoint(0, 0)
        labelNode.addComponent(cc.Label)
        labelNode.getComponent(cc.Label).string = "【"+name+"】说：" + text
        let label2 = cc.find('/OutterLayout/ScrollViewContainer/scrollview/view/content/label')
        let scrollView = cc.find('/OutterLayout/ScrollViewContainer/scrollview/view/content')
        console.log(typeof(scrollView), scrollView, typeof(labelNode), labelNode, typeof(label2), label2)
        labelNode.parent = scrollView
        this.chatItems.unshift(labelNode)
        if (this.chatItems.length > 100) {
            let removeItem = this.chatItems.pop()
            removeItem.removeFromParent()
        }

        this.updateChatItemPositions()
    },

    updateChatItemPositions: function() {
        let x = 10
        let ygap = 5
        var y = 10
        for (var i=0; i<this.chatItems.length; i++) {
            let item = this.chatItems[i]
            item.setPosition(x, y)
            let size = item.getContentSize()
            y += size.height + ygap
        }
    },

    // called every frame, uncomment this function to activate update callback
    // update: function (dt) {

    // },
});
