// 站点内容：改这一个文件，封面和 3D 屋子里的卡片会一起更新。
// 文字里的换行由数组顺序决定；不要在这里写 HTML 标签。
// 这里用普通脚本（不是 ES module），所以直接双击 index.html 也能读到。

window.SITE_CONTENT = {
  // ---------- 我是谁 ----------
  profile: {
    name: '黄建',
    latin: 'JIAN.HUANG',
    // 首屏大标题下面那行
    headline: '一份可以走进去的个人说明书',
    // 顶部小字
    eyebrow: 'PERSONAL MANUAL · 2026',
    org: '爱玛科技集团',
    department: '智能平台开发部',
    // 部门全路径，会显示成「甲 / 乙 / 丙」
    deptPath: ['国内事业部', '研发体系', '平台开发中心', '智能开发部', '智能平台开发部'],
    // 首屏引言
    lede: '在爱玛科技集团智能平台开发部做研发。白天把业务需求变成能跑的系统，剩下的时间琢磨怎么让同事少点几下。这间屋子就是我的名片——关于我、负责的项目、在哪儿办公，都写在里面。',
    // 「关于我」正文，一段一条
    paragraphs: [
      '我是黄建，在智能平台开发部做研发。',
      '白天把业务需求变成能跑的系统，剩下的时间琢磨怎么让同事少点几下。这间屋子就是我的名片：走到工作台前看我做过什么，走到邮箱前留言。',
    ],
    // ---------- 「关于我」左侧人像 ----------
    // 已经换成你上传的那张照片（1200×1600，3:4，已居中裁切）。
    // 想换新的，同名覆盖 assets/profile.webp 即可，代码不用动；
    // 若用 .jpg / .png，把下面这行的后缀一起改掉（assets/profile.jpg）。
    photo: 'assets/profile.webp',
    // 图片下面那行小字
    photoCaption: '旅行途中，朋友帮忙拍的。',
    // 旧配图：photo 留空时兑底用。
    image: '/spark/app/app_17hc9s38g4a/runtime/api/v1/storage/object/bucket_aadk5kmwhr4ca_static/static%2Faadk5kzjfvqbi_ve_miaoda',
    imageCaption: '工作台：两台显示器、一张草图、一杯没喝完的茶。',
    // 「和我协作」的四条，编号会自动生成
    creed: [
      '先说结论，再补背景。不确定的事我会直接说不确定。',
      '能跑通的原型，好过一份完美的 PPT。',
      '评审先看边界和异常，再看界面好不好看。',
      '随时打断我，不用预约时间。',
    ],
  },

  // ---------- 负责的项目 ----------
  // 一条一个对象，格式固定：title 名称 / summary 一两句说明 / role 你的角色 / tags 关键词。
  // 想加第四个，直接复制一条改内容；删掉一条，封面和 3D 里的项目板会一起少一条。
  projects: [
    {
      title: '零际（APP/后台）',
      summary: '支撑零际 APP 的核心业务接口及独立运营后台。',
      role: '后端开发',
      tags: ['电摩'],
      app: {
        name: '零际',
        icon: 'assets/apps/scoox.webp',
        store: 'https://apps.apple.com/cn/app/scoox/id6743694445',
      },
    },
    {
      title: '智爱（APP/后台）',
      summary: '支撑智爱 APP 的核心业务接口及独立运营后台',
      role: '后端开发',
      tags: ['四轮'],
      app: {
        name: '智爱出行',
        icon: 'assets/apps/zhiai.webp',
        store: 'https://apps.apple.com/cn/app/%E6%99%BA%E7%88%B1%E5%87%BA%E8%A1%8C/id6783774431',
      },
    },
  ],

  // ---------- 办公地点 ----------
  office: {
    city: '天津',
    site: '爱玛科技集团总部',
    desk: 'F2-B-03',
    deskHint: '',
    hours: '工作日 8:30 – 17:30',
    hoursHint: '下午两点后最容易抓到人；开会时飞书也会看',
    howTo: '优先飞书，其次直接来工位；远程会议随时约。如果只是路过天津，欢迎上来坐坐，楼下有咖啡。',
    coord: '39.0842°N 117.2009°E',
  },

  // ---------- 联系方式 ----------
  contact: {
    email: 'huangjian@aimatech.com',
    feishu: '黄建',
    note: '正式材料、对外协作走邮箱；日常问题飞书上最快。想聊合作或者只是打个招呼，都欢迎。',
  },
};
