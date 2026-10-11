import { getGithubService } from "./github-export.js";
import { prisma } from "./prisma.js";

// Ported from SAAS/backend/src/modules/website/react-export.service.ts.
// Generates a static Vite+React+Tailwind codebase from a business's saved
// WebsiteConfig blocks and pushes it to a new GitHub repo.

interface WebsiteBlock {
  type: string;
  props: Record<string, unknown>;
}

export async function generateReactAppAndExportToGitHub(businessId: string, repoName: string): Promise<string> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new Error("Business not found");

  const config = await prisma.websiteConfig.findUnique({ where: { businessId } });
  if (!config) throw new Error("Website config not found -- generate a storefront first");

  const blocks: WebsiteBlock[] = Array.isArray(config.blocks) ? (config.blocks as unknown as WebsiteBlock[]) : [];
  const themeObj = (config.theme ?? {}) as { primaryColor?: string };
  const primaryColor = themeObj.primaryColor ?? "#10b981";

  const files = [
    { path: "package.json", content: generatePackageJson(business.name) },
    { path: "vite.config.ts", content: generateViteConfig() },
    { path: "index.html", content: generateIndexHtml(business.name) },
    { path: "src/main.tsx", content: generateMainTsx() },
    { path: "src/index.css", content: generateIndexCss() },
    { path: "src/App.tsx", content: generateAppTsx(business, blocks, primaryColor) },
    { path: "tailwind.config.js", content: generateTailwindConfig(primaryColor) },
    { path: "postcss.config.js", content: generatePostcssConfig() },
  ];

  const github = getGithubService();
  if (!github.isConfigured) {
    throw new Error("GitHub API token is not configured in backend");
  }

  const fullRepoName = await github.createRepo(repoName, `Generative Storefront for ${business.name}`);
  await github.commitFiles(fullRepoName, files, "Initial React Codebase Export from BusinessOS AI");

  await prisma.websiteConfig.update({
    where: { businessId },
    data: { githubRepo: fullRepoName, githubDeployUrl: `https://github.com/${fullRepoName}` },
  });

  return fullRepoName;
}

function generatePackageJson(name: string) {
  return JSON.stringify(
    {
      name: name.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
      dependencies: { "lucide-react": "^0.344.0", react: "^18.2.0", "react-dom": "^18.2.0" },
      devDependencies: {
        "@types/react": "^18.2.56",
        "@types/react-dom": "^18.2.19",
        "@vitejs/plugin-react": "^4.2.1",
        autoprefixer: "^10.4.17",
        postcss: "^8.4.35",
        tailwindcss: "^3.4.1",
        typescript: "^5.2.2",
        vite: "^5.1.4",
      },
    },
    null,
    2,
  );
}

function generateViteConfig() {
  return ["import { defineConfig } from 'vite';", "import react from '@vitejs/plugin-react';", "", "export default defineConfig({", "  plugins: [react()],", "});"].join("\n");
}

function generateIndexHtml(title: string) {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="UTF-8" />',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    `    <title>${title}</title>`,
    "  </head>",
    "  <body>",
    '    <div id="root"></div>',
    '    <script type="module" src="/src/main.tsx"></script>',
    "  </body>",
    "</html>",
  ].join("\n");
}

function generateMainTsx() {
  return [
    "import React from 'react';",
    "import ReactDOM from 'react-dom/client';",
    "import App from './App.tsx';",
    "import './index.css';",
    "",
    "ReactDOM.createRoot(document.getElementById('root')!).render(",
    "  <React.StrictMode>",
    "    <App />",
    "  </React.StrictMode>,",
    ");",
  ].join("\n");
}

function generateIndexCss() {
  return ["@tailwind base;", "@tailwind components;", "@tailwind utilities;", "", "html { scroll-behavior: smooth; }"].join("\n");
}

function generateTailwindConfig(primaryColor: string) {
  return [
    "/** @type {import('tailwindcss').Config} */",
    "export default {",
    "  content: [",
    "    './index.html',",
    "    './src/**/*.{js,ts,jsx,tsx}',",
    "  ],",
    "  theme: {",
    "    extend: {",
    "      colors: {",
    `        primary: '${primaryColor}',`,
    "      }",
    "    },",
    "  },",
    "  plugins: [],",
    "}",
  ].join("\n");
}

function generatePostcssConfig() {
  return ["export default {", "  plugins: {", "    tailwindcss: {},", "    autoprefixer: {},", "  },", "}"].join("\n");
}

function generateAppTsx(business: { name: string; phone: string | null }, blocks: WebsiteBlock[], primaryColor: string) {
  let jsx = "";

  if (blocks.length === 0) {
    jsx = '<div className="py-40 text-center"><h2 className="text-2xl text-gray-600">No content blocks found. Please run the AI generator.</h2></div>';
  }

  for (const block of blocks) {
    const props = block.props as Record<string, string | undefined> & { features?: { title?: string; description?: string }[] };
    if (block.type === "RawHtml") {
      const htmlStr = (props.html ?? "").replace(/{{PRIMARY_COLOR}}/g, primaryColor);
      jsx += `        <div dangerouslySetInnerHTML={{ __html: ${JSON.stringify(htmlStr)} }} />`;
    } else if (block.type === "Hero") {
      jsx += [
        '        <section className="bg-gradient-to-br from-gray-900 to-black text-white py-20 px-4 sm:px-6 lg:px-8 text-center relative overflow-hidden">',
        '          <div className="absolute inset-0 bg-blue-500/10 blur-3xl rounded-full translate-y-1/2"></div>',
        '          <div className="relative z-10 max-w-4xl mx-auto">',
        `            <span className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold mb-6" style={{ background: "${primaryColor}20", color: "${primaryColor}", border: "1px solid ${primaryColor}40" }}>${props.badge ?? ""}</span>`,
        `            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6">${props.title ?? ""}</h1>`,
        `            <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-2xl mx-auto">${props.subtitle ?? ""}</p>`,
        '            <div className="flex flex-col sm:flex-row gap-4 justify-center">',
        `              <button className="px-8 py-4 rounded-xl font-bold text-white shadow-lg transition-transform hover:scale-105" style={{ background: "${primaryColor}" }}>${props.ctaPrimary ?? "Get Started"}</button>`,
        `              <button className="px-8 py-4 rounded-xl font-bold text-white border border-gray-600 hover:bg-gray-800 transition-colors">${props.ctaSecondary ?? "Learn More"}</button>`,
        "            </div>",
        "          </div>",
        "        </section>",
      ].join("\n");
    } else if (block.type === "FeatureGrid") {
      const features = props.features ?? [];
      const featuresJsx = features
        .map((f) =>
          [
            `                <div key="${f.title ?? Math.random()}" className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">`,
            `                  <h3 className="text-xl font-bold mb-3 text-gray-900">${f.title ?? ""}</h3>`,
            `                  <p className="text-gray-600 leading-relaxed">${f.description ?? ""}</p>`,
            "                </div>",
          ].join("\n"),
        )
        .join("\n");

      jsx += [
        '        <section className="py-20 bg-gray-50 px-4 sm:px-6 lg:px-8">',
        '          <div className="max-w-7xl mx-auto">',
        '            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">',
        featuresJsx,
        "            </div>",
        "          </div>",
        "        </section>",
      ].join("\n");
    } else if (block.type === "ContactForm") {
      jsx += [
        '        <section className="py-20 bg-gray-900 text-white px-4">',
        '          <div className="max-w-3xl mx-auto text-center">',
        `            <h2 className="text-3xl font-bold mb-8">${props.title ?? "Contact Us"}</h2>`,
        '            <div className="bg-gray-800 p-8 rounded-2xl border border-gray-700">',
        `              <p className="text-xl mb-4">Email: ${props.email ?? ""}</p>`,
        `              <p className="text-gray-400">Call us at ${business.phone ?? ""}</p>`,
        "            </div>",
        "          </div>",
        "        </section>",
      ].join("\n");
    }
  }

  return [
    "import React from 'react';",
    "",
    "export default function App() {",
    "  return (",
    '    <div className="font-sans antialiased text-gray-900 bg-gray-50 min-h-screen selection:bg-primary/20 selection:text-primary">',
    '      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">',
    '        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">',
    `          <div className="font-bold text-xl tracking-tight">${business.name}</div>`,
    '          <button className="bg-black text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors">Cart</button>',
    "        </div>",
    "      </header>",
    "",
    "      <main>",
    jsx,
    "      </main>",
    "",
    '      <footer className="bg-black text-white py-12 px-4 text-center">',
    `        <p className="text-gray-400">© ${new Date().getFullYear()} ${business.name}. Powered by Generative AI Code Export.</p>`,
    "      </footer>",
    "    </div>",
    "  );",
    "}",
  ].join("\n");
}
