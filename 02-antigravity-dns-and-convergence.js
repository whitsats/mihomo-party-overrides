/**
 * ==============================================================================
 * 覆写模块 2：全局标准 DNS 规范化与 Antigravity 出口收敛保护 (Antigravity Architecture Standard)
 * ==============================================================================
 * 
 * 核心设计目标：
 * 1. 彻底根除各机场订阅下发的异常 Fake-IP 范围 (如 28.0.0.1/8) 与私有脏 DNS。
 * 2. 强制关闭 IPv6 解析，根治 Windows 双栈网络下的 AAAA 记录超时卡顿 (5~10s 延迟)。
 * 3. 规范 Fake-IP 过滤名单，杜绝通配符 '*' 导致的 Fake-IP 机制瘫痪。
 * 4. 【核心防御】Antigravity 专属 DNS 强化：所有 Google/Gemini/Deepmind/Cloud Run 域名绑定海外安全 DoH。
 * 5. 【核心防御】Antigravity 专属出口对齐：自适应查找主节点选择组，将 Antigravity 全系流量
 *    强制收敛至同一代理通道，彻底消除多节点 IP 漂移造成的 Google 鉴权失效与会话频繁断联。
 */

function main(config) {
  // 1. 防御性基础校验
  if (!config || typeof config !== "object") {
    return config;
  }

  try {
    // --------------------------------------------------------------------------
    // 一、 全局 DNS 引擎标准化与深度清洗
    // --------------------------------------------------------------------------
    config.dns = {
      enable: true,
      ipv6: false,                        // 强制关闭 IPv6，杜绝双栈竞争超时
      listen: "127.0.0.1:5353",
      "enhanced-mode": "fake-ip",          // 锁定虚拟 IP 映射模式
      "fake-ip-range": "198.18.0.1/16",    // 严格遵循 IETF RFC 2544 / RFC 5735 保留网段
      "use-hosts": true,
      "use-system-hosts": false,           // 隔离系统 Hosts，防止本地污染破坏分流
      "respect-rules": false,

      // 引导 DNS：用于解析 DoH/DoT 主机名自身（Bootstrapping）
      "default-nameserver": [
        "223.5.5.5",
        "119.29.29.29",
        "tls://223.5.5.5:853",
        "tls://120.53.53.53:853"
      ],

      // 节点服务器域名解析：解析各机场节点自身服务器 IP
      "proxy-server-nameserver": [
        "https://223.5.5.5/dns-query",
        "https://120.53.53.53/dns-query"
      ],

      // 国内基础解析服务器组：用于直连域名的快速解析与精准 CDN 调度
      nameserver: [
        "https://223.5.5.5/dns-query",
        "https://120.53.53.53/dns-query",
        "tls://223.5.5.5:853",
        "tls://120.53.53.53:853"
      ],

      // 境外回退解析服务器组：用于非直连与境外域名的安全加密解析
      fallback: [
        "https://1.1.1.1/dns-query",
        "https://8.8.8.8/dns-query",
        "tls://1.1.1.1:853",
        "tls://8.8.8.8:853"
      ],

      // 回退过滤器：精准防止 DNS 污染进入国内 CDN
      "fallback-filter": {
        geoip: true,
        "geoip-code": "CN",
        ipcidr: [
          "240.0.0.0/4",
          "0.0.0.0/32"
        ],
        domain: [
          "+.google.com",
          "+.facebook.com",
          "+.youtube.com",
          "+.github.com",
          "+.openai.com",
          "+.anthropic.com",
          "+.run.app",
          "+.goog"
        ]
      },

      // 核心海外生态与 Antigravity 强行锁定海外安全解析通道 (DoH)
      "nameserver-policy": {
        // Antigravity & Google 核心通道
        "+.goog": "https://8.8.8.8/dns-query",
        "+.run.app": "https://8.8.8.8/dns-query",
        "+.googleapis.com": "https://8.8.8.8/dns-query",
        "+.googleusercontent.com": "https://8.8.8.8/dns-query",
        "+.google.com": "https://8.8.8.8/dns-query",
        "+.gemini.google.com": "https://8.8.8.8/dns-query",
        "+.generativelanguage.googleapis.com": "https://8.8.8.8/dns-query",
        "+.deepmind.com": "https://8.8.8.8/dns-query",
        "+.deepmind.google": "https://8.8.8.8/dns-query",
        "+.g.co": "https://8.8.8.8/dns-query",
        
        // 核心 AI 生态
        "+.openai.com": "https://8.8.8.8/dns-query",
        "+.chatgpt.com": "https://8.8.8.8/dns-query",
        "+.oaistatic.com": "https://8.8.8.8/dns-query",
        "+.oaiusercontent.com": "https://8.8.8.8/dns-query",
        "+.claude.ai": "https://8.8.8.8/dns-query",
        "+.anthropic.com": "https://8.8.8.8/dns-query",

        // 开发者基础生态
        "+.github.com": "https://8.8.8.8/dns-query",
        "+.githubusercontent.com": "https://8.8.8.8/dns-query"
      },

      // 严格规范 Fake-IP 绕过过滤名单（严禁包含 '*'）
      "fake-ip-filter": [
        "*.lan",
        "*.local",
        "*.localhost",
        "localhost.ptlogin2.qq.com",
        "localhost.sec.qq.com",
        "*.msftconnecttest.com",
        "*.msftncsi.com",
        "dns.msftncsi.com",
        "captive.apple.com",
        "+.ntp.org",
        "time.windows.com",
        "time.apple.com",
        "time.*.com",
        "ntp.*.com",
        "+.stun.*.*",
        "+.stun.*.*.*",
        "*.router.asus.com",
        "*.tplinkwifi.net"
      ]
    };

    // --------------------------------------------------------------------------
    // 二、 Antigravity 出口对齐与防断联规则注入 (Rules Pipeline)
    // --------------------------------------------------------------------------
    if (Array.isArray(config["proxy-groups"]) && config["proxy-groups"].length > 0) {
      if (!Array.isArray(config.rules)) {
        config.rules = [];
      }

      const groups = config["proxy-groups"];
      let mainSelectGroup = null;

      // 优先级 1: 名称明确包含“节点选择”的主策略组（如“🚀 节点选择”或“节点选择”）
      for (let i = 0; i < groups.length; i++) {
        if (groups[i] && groups[i].name && groups[i].name.indexOf("节点选择") !== -1) {
          mainSelectGroup = groups[i].name;
          break;
        }
      }

      // 优先级 2: 首个类型为 select 且非黑名单功能的代理组
      if (!mainSelectGroup) {
        const ignoreKeywords = ["广告", "拦截", "漏网", "直接", "DIRECT", "REJECT", "国内", "应用"];
        for (let j = 0; j < groups.length; j++) {
          const g = groups[j];
          if (g && g.type === "select" && g.name) {
            let isIgnored = false;
            for (let k = 0; k < ignoreKeywords.length; k++) {
              if (g.name.indexOf(ignoreKeywords[k]) !== -1) {
                isIgnored = true;
                break;
              }
            }
            if (!isIgnored) {
              mainSelectGroup = g.name;
              break;
            }
          }
        }
      }

      // 优先级 3: 默认兜底使用首个代理组
      if (!mainSelectGroup && groups.length > 0) {
        mainSelectGroup = groups[0].name;
      }

      // 成功定位主代理组后，注入 Antigravity 全系收敛规则至头部
      if (mainSelectGroup) {
        const agRules = [
          // Antigravity 核心通道与 Cloud Run 节点绑定
          "DOMAIN-SUFFIX,goog," + mainSelectGroup,
          "DOMAIN-SUFFIX,run.app," + mainSelectGroup,
          "DOMAIN-SUFFIX,googleapis.com," + mainSelectGroup,
          "DOMAIN-SUFFIX,googleusercontent.com," + mainSelectGroup,
          "DOMAIN-SUFFIX,deepmind.com," + mainSelectGroup,
          "DOMAIN-SUFFIX,deepmind.google," + mainSelectGroup,
          "DOMAIN-SUFFIX,g.co," + mainSelectGroup,
          "DOMAIN-KEYWORD,antigravity," + mainSelectGroup
        ];

        // 倒序依次推入 rules 数组头部，保证其优先级仅次于最前面的本地直连规则
        for (let rIdx = agRules.length - 1; rIdx >= 0; rIdx--) {
          const ruleItem = agRules[rIdx];
          if (config.rules.indexOf(ruleItem) === -1) {
            config.rules.unshift(ruleItem);
          }
        }
      }
    }

    // --------------------------------------------------------------------------
    // 三、 TUN 与 嗅探器自适应强化
    // --------------------------------------------------------------------------
    if (config.tun && typeof config.tun === "object") {
      config.tun["auto-route"] = true;
      config.tun["auto-detect-interface"] = true;
      if (!Array.isArray(config.tun["dns-hijack"])) {
        config.tun["dns-hijack"] = ["any:53"];
      } else if (config.tun["dns-hijack"].indexOf("any:53") === -1) {
        config.tun["dns-hijack"].push("any:53");
      }
    }

    if (!config.sniffer || typeof config.sniffer !== "object") {
      config.sniffer = {
        enable: true,
        "parse-pure-ip": true,
        "force-dns-mapping": true,
        sniff: {
          HTTP: { ports: [80, 8080], "override-destination": false },
          TLS: { ports: [443, 8443] }
        }
      };
    } else {
      config.sniffer.enable = true;
      config.sniffer["parse-pure-ip"] = true;
      config.sniffer["force-dns-mapping"] = true;
    }

  } catch (err) {
    console.error("[Antigravity-DNS-Override] Failed to execute:", err);
  }

  return config;
}
