/**
 * ==============================================================================
 * 覆写模块 1：国内核心大模型 API 与微软服务直连保障 (Domestic Direct Rules)
 * ==============================================================================
 * 
 * 作用：
 * 1. 规避代理节点对国内大模型 API（商汤、智谱、火山引擎、Agnes 等）的访问阻断与计费异常。
 * 2. 避免微软 Bing / Microsoft Rewards 被代理节点判定为跨区导致风控封号。
 * 3. 保证特选开发跳板机 SSH 端口直连，避免长连接代理重定向中断。
 */

function main(config) {
  if (!config || typeof config !== "object") {
    return config;
  }

  // 健壮性处理：确保 rules 数组存在
  if (!Array.isArray(config.rules)) {
    config.rules = [];
  }

  // 优先级最高的直连规则队列
  const directRules = [
    // 关键生产环境跳板机 SSH 直连（规避代理长连接截断）
    'AND,((DST-PORT,22),(IP-CIDR,35.212.225.115/32)),DIRECT',

    // 微软国内直连服务
    'DOMAIN-SUFFIX,bing.com,DIRECT',
    'DOMAIN,rewards.microsoft.com,DIRECT',

    // 国内主流大模型开发 API 直连通道
    'DOMAIN-SUFFIX,sensenova.cn,DIRECT', // 商汤日日新 SenseNova
    'DOMAIN-SUFFIX,bigmodel.cn,DIRECT',  // 智谱 AI (GLM)
    'DOMAIN-SUFFIX,volces.com,DIRECT',    // 火山引擎 (豆包 / Skylark)
    'DOMAIN-SUFFIX,agnes-ai.cn,DIRECT'   // Agnes AI 平台
  ];

  // 倒序依次推入头部，确保最高优先级
  for (let i = directRules.length - 1; i >= 0; i--) {
    const rule = directRules[i];
    if (config.rules.indexOf(rule) === -1) {
      config.rules.unshift(rule);
    }
  }

  return config;
}
