
cc.Class({
    extends: cc.Component,

    properties: {
        // foo: {
        //    default: null,      // The default value will be used only when the component attaching
        //                           to a node for the first time
        //    url: cc.Texture2D,  // optional, default is typeof default
        //    serializable: true, // optional, default is true
        //    visible: true,      // optional, default is true
        //    displayName: 'Foo', // optional
        //    readonly: false,    // optional, default is false
        // },
        // ...
        typeName: {
            default: '',  
            readonly: true, 
        },
        
        ID: {
            default: '', 
            readonly: true, 
        }
        
    },

    // use this for initialization
    onLoad: function () {
        
    },

    create: function(owner, typeName, entityID) {
        this.owner = owner 
        this.typeName = typeName
        this.ID = entityID
        this.isPlayer = false
    },

    toString: function() {
        return this.typeName + "<" + this.ID + ">"
    },

    onCreated: function() {
        if (this.typeName == "Account") {
            console.log("Account created, start logining...")
        }
    },

    // called every frame, uncomment this function to activate update callback
    update: function (dt) {
        console.log("GameClient tick")
    },
    
    callServer: function( method ) {
        var args = Array.prototype.slice.call(arguments);
        args = args.slice(1)
        this.owner.callServerMethod( this, method, args )
    },

    onCall: function(method, args) {
        console.log(this.toString()+"."+method+"("+args+")")
        this[method](...args)
    },

    onBecomePlayer: function() {
        let scene = cc.director.getScene()
        
        console.log("获得玩家对象：", this.toString(), scene.name)
        if (this.typeName == "Avatar") {
            // 玩家登录成功！
            this.getGoWorld().onAvatarLoginSuccess( this )
        } else if (this.typeName == "Account") {
            // 账号创建成功，可以开始登陆
            if (scene.name != "login") {
                cc.director.loadScene("login");
            }
        }
    },

    // Put Client Methods Here 
    ShowError: function(msg) {
        this.getGoWorld().showErrorTip(msg)
    },

    ShowInfo: function(msg) {
        this.getGoWorld().showErrorTip(msg)
    },
    
    OnRecvChat: function(text) {
        this.getGoWorld()
    },

    getGoWorld: function() {
        let goworld = cc.find("GoWorld").getComponent("GoWorld")
        return goworld
    },
});
