export default {
  name: '黄建',
  // 换一张 64×64 的 Minecraft 皮肤就能换成自己的形象（docs/avatar.md）。
  skin: '',
  languages: ['zh'],
  // 填上城市与经纬度即可在 3D 里打开「实时」天气；留空则只用手动时段与天气。
  weather: null,
  start: { weather: 'clear', time: 'morning' },
  dock: ['about', 'works', 'lab', 'mailbox', 'phone'],
  // 没有部署留言后端时，留言会打开访客的邮件客户端，寄到这个地址。
  mailbox: { endpoint: '', email: 'huangjian@aimatech.com', turnstileSitekey: '' },
  // 不连公共传送门目录，进屋时不会发出外部请求。
  portal: { directory: [] },
  badge: true,
};
