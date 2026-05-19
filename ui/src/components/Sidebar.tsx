'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Home, Settings, BrainCircuit, Images, Plus, ImageDown,
  Tags, Code2, ChevronDown, ChevronRight, ExternalLink,
  Heart, MessageCircle, QrCode
} from 'lucide-react';
import { FaXTwitter, FaDiscord, FaYoutube, FaBilibili, FaWeixin, FaQq } from 'react-icons/fa6';

const Sidebar = () => {
  const [aboutOpen, setAboutOpen] = useState(false);

  const navigation = [
    { name: '仪表盘', href: '/dashboard', icon: Home },
    { name: '新建任务', href: '/jobs/new', icon: Plus },
    { name: '训练任务', href: '/jobs', icon: BrainCircuit },
    { name: '数据集', href: '/datasets', icon: Images },
    { name: '图片处理', href: '/image-batch', icon: ImageDown },
    { name: '图片打标', href: '/ollama-tagging', icon: Tags },
    { name: '设置', href: '/settings', icon: Settings },
  ];

  const socialsBoxClass =
    'flex flex-col items-center justify-center p-1 hover:bg-gray-800 rounded-lg transition-colors';
  const socialIconClass = 'w-5 h-5 text-gray-400 hover:text-white';

  return (
    <div className="flex flex-col w-59 bg-gray-900 text-gray-100">
      <div className="px-4 py-3">
        <h1 className="text-l">
          <img src="/ostris_logo.png" alt="Ostris AI Toolkit" className="w-auto h-7 mr-3 inline" />
          <span className="font-bold uppercase">Ostris</span>
          <span className="ml-2 uppercase text-gray-300">AI-Toolkit</span>
        </h1>
      </div>
      <nav className="flex-1 overflow-y-auto">
        <ul className="px-2 py-4 space-y-2">
          {navigation.map(item => (
            <li key={item.name}>
              <Link
                href={item.href}
                className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            </li>
          ))}
          {/* 分隔线 */}
          <li className="px-4 py-1">
            <div className="h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
          </li>
          {/* 继续开发 */}
          <li>
            <button
              onClick={() => setAboutOpen(!aboutOpen)}
              className="flex items-center w-full px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors group"
            >
              <Code2 className="w-5 h-5 mr-3 text-purple-400 group-hover:text-purple-300 transition-colors" />
              <span className="flex-1 text-left">继续开发</span>
              {aboutOpen ? (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-purple-500/60 animate-pulse" />
              )}
            </button>
            {aboutOpen && (
              <div className="mx-3 mt-2 overflow-hidden rounded-xl border border-gray-700/60 bg-gradient-to-b from-gray-800/90 to-gray-900/90 shadow-lg shadow-purple-900/10">
                {/* 顶部装饰条 */}
                <div className="h-1 bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500" />

                {/* 作者区域 */}
                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md">
                      <Heart className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">作者</p>
                      <p className="text-white font-semibold text-sm">薇薇的猫</p>
                    </div>
                  </div>

                  {/* B站链接 */}
                  <a
                    href="https://space.bilibili.com/472768517"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-pink-600/10 hover:bg-pink-600/20 border border-pink-600/20 hover:border-pink-600/40 text-pink-300 transition-all duration-200 group"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.562 3.76v6.702c-.038 1.51-.558 2.765-1.562 3.761s-2.263 1.52-3.773 1.574H5.333c-1.51-.054-2.769-.578-3.773-1.574C.556 19.454.036 18.2-.002 16.689V9.987c.038-1.511.558-2.765 1.562-3.76 1.004-.996 2.263-1.52 3.773-1.574h.854l-.89-1.28a.713.713 0 0 1-.154-.723.72.72 0 0 1 .575-.465.76.76 0 0 1 .729.279L7.51 4.653h8.98l1.389-2.034a.747.747 0 0 1 .683-.345.734.734 0 0 1 .618.47.72.72 0 0 1-.148.712l-.92 1.226zM5.333 6.07c-.967.035-1.772.352-2.417.952-.645.6-.969 1.398-.97 2.396v6.702c.001.998.325 1.796.97 2.396.645.6 1.45.917 2.417.952h13.334c.967-.035 1.772-.352 2.417-.952.645-.6.969-1.398.97-2.396V9.418c-.001-.998-.325-1.796-.97-2.396-.645-.6-1.45-.917-2.417-.952H5.333zm5.334 2.666v4.107a.445.445 0 0 0 .447.444.445.445 0 0 0 .446-.444V8.736a.445.445 0 0 0-.446-.443.445.445 0 0 0-.447.443zm-3.334 0v4.107a.445.445 0 0 0 .447.444.445.445 0 0 0 .446-.444V8.736a.445.445 0 0 0-.446-.443.445.445 0 0 0-.447.443zm6.614 0v4.107a.445.445 0 0 0 .447.444.445.445 0 0 0 .446-.444V8.736a.445.445 0 0 0-.446-.443.445.445 0 0 0-.447.443zm-5.668 5.974c-.519 0-.94.173-1.263.518-.322.345-.483.756-.483 1.234 0 .478.161.889.483 1.234.322.345.744.518 1.263.518.519 0 .94-.173 1.263-.518.322-.345.483-.756.483-1.234 0-.478-.161-.889-.483-1.234-.322-.345-.744-.518-1.263-.518zm8 0c-.519 0-.94.173-1.263.518-.322.345-.483.756-.483 1.234 0 .478.161.889.483 1.234.322.345.744.518 1.263.518.519 0 .94-.173 1.263-.518.322-.345.483-.756.483-1.234 0-.478-.161-.889-.483-1.234-.322-.345-.744-.518-1.263-.518z"/>
                    </svg>
                    <span className="flex-1 text-sm">B站主页</span>
                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </a>

                  {/* GitHub 仓库 */}
                  <a
                    href="https://github.com/wwsmiao/wwdm-aitoolkit"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-600/10 hover:bg-gray-600/20 border border-gray-600/20 hover:border-gray-600/40 text-gray-300 transition-all duration-200 group"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    <span className="flex-1 text-sm">GitHub 仓库</span>
                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </a>

                  <div className="border-t border-gray-700/50" />

                  {/* 联系方式 */}
                  <div className="space-y-2">
                    <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">联系方式</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 text-gray-300">
                        <MessageCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm">微信：weiweismiao</span>
                      </div>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50 text-gray-300">
                        <svg className="w-4 h-4 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C8.686 2 6 4.341 6 7.22c0 1.654.729 3.139 1.89 4.156.689.605 1.11 1.443 1.11 2.374 0 .845.42 1.604 1.07 2.08a4.33 4.33 0 0 0 2.435.78h.99a4.33 4.33 0 0 0 2.435-.78c.65-.476 1.07-1.235 1.07-2.08 0-.931.421-1.77 1.11-2.374C17.27 10.36 18 8.874 18 7.22 18 4.34 15.314 2 12 2zm0 2c2.232 0 4 1.447 4 3.22 0 1.135-.533 2.19-1.46 2.97-.996.84-1.54 1.976-1.54 3.13 0 .17-.069.321-.183.431a.56.56 0 0 1-.407.169h-.82a.56.56 0 0 1-.407-.169.609.609 0 0 1-.183-.431c0-1.154-.544-2.29-1.54-3.13C8.533 9.41 8 8.355 8 7.22 8 5.447 9.768 4 12 4zM7 16c-2.757 0-5 1.794-5 4v1c0 .552.448 1 1 1h10v-2H4.22c.335-.637 1.322-1.253 2.906-1.545A.987.987 0 0 1 7.59 19.2c.284.377.923.65 1.467.738a8.058 8.058 0 0 0 1.697.062h2.086c.69 0 1.36-.088 1.99-.255A3.493 3.493 0 0 0 17 19.99a8.625 8.625 0 0 0 1.838-.28c.47-.114.892-.275 1.255-.474L21 19.5v-.5c0-2.206-2.243-4-5-4h-2c-.354 0-.702.04-1.04.11-.26.054-.518.124-.77.206C12.08 15.28 11.82 16 11.82 16H10.7s.01-.72.34-1.09a6.435 6.435 0 0 1-.363-.18A4.562 4.562 0 0 0 9 16H7z" />
                        </svg>
                        <span className="text-sm">QQ：1579493251</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700/50" />

                  {/* 更新日志 */}
                  <div className="space-y-2">
                    <p className="text-gray-400 text-[11px] uppercase tracking-wider font-medium">更新日志</p>
                    <div className="relative pl-3 border-l-2 border-purple-500/40 space-y-2">
                      <div className="relative">
                        <div className="absolute -left-[17px] top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-gray-900" />
                        <p className="text-yellow-400/90 text-[11px] font-medium">2026.5.18</p>
                        <div className="mt-1 space-y-0.5 text-gray-400 text-xs">
                          <p className="flex items-start gap-1.5">
                            <span className="text-purple-400 mt-0.5">✦</span>
                            <span>增加图片处理功能</span>
                          </p>
                          <p className="flex items-start gap-1.5">
                            <span className="text-purple-400 mt-0.5">✦</span>
                            <span>增加图片打标功能</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </li>
        </ul>
      </nav>
      <a
        href="https://ostris.com/support"
        target="_blank"
        rel="noreferrer"
        className="flex items-center space-x-2 px-4 py-3"
      >
        <div className="min-w-[26px] min-h-[26px]">
          <svg height="24" version="1.1" width="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(0 -1028.4)">
              <path
                d="m7 1031.4c-1.5355 0-3.0784 0.5-4.25 1.7-2.3431 2.4-2.2788 6.1 0 8.5l9.25 9.8 9.25-9.8c2.279-2.4 2.343-6.1 0-8.5-2.343-2.3-6.157-2.3-8.5 0l-0.75 0.8-0.75-0.8c-1.172-1.2-2.7145-1.7-4.25-1.7z"
                fill="#c0392b"
              />
            </g>
          </svg>
        </div>
        <div className="uppercase text-gray-500 text-sm mb-2 flex-1 pt-2 pl-0">Support AI-Toolkit</div>
      </a>

      <div className="px-1 py-1 border-t border-gray-800">
        <div className="grid grid-cols-3 gap-4">
          <a href="https://discord.gg/VXmU2f5WEU" target="_blank" rel="noreferrer" className={socialsBoxClass}>
            <FaDiscord className={socialIconClass} />
          </a>
          <a href="https://www.youtube.com/@ostrisai" target="_blank" rel="noreferrer" className={socialsBoxClass}>
            <FaYoutube className={socialIconClass} />
          </a>
          <a href="https://x.com/ostrisai" target="_blank" rel="noreferrer" className={socialsBoxClass}>
            <FaXTwitter className={socialIconClass} />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;