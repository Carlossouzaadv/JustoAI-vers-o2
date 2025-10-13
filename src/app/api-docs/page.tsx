'use client';

import { useEffect, useRef } from 'react';

export default function ApiDocsPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Carregar Swagger UI dinamicamente no cliente
    const loadSwaggerUI = async () => {
      if (typeof window !== 'undefined') {
        // Importar dinamicamente o Swagger UI
        const SwaggerUIBundle = (await import('swagger-ui-dist/swagger-ui-bundle.js')).default;
        const SwaggerUIStandalonePreset = (await import('swagger-ui-dist/swagger-ui-standalone-preset.js')).default;

        // Inicializar Swagger UI
        SwaggerUIBundle({
          url: '/api/swagger',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          plugins: [
            SwaggerUIBundle.plugins.DownloadUrl
          ],
          layout: 'StandaloneLayout',
          persistAuthorization: true,
          tryItOutEnabled: true,
          displayRequestDuration: true,
          filter: true,
          syntaxHighlight: {
            activate: true,
            theme: 'monokai'
          }
        });
      }
    };

    loadSwaggerUI();
  }, []);

  return (
    <>
      <head>
        <link
          rel="stylesheet"
          type="text/css"
          href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
        />
        <style>{`
          html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
          }

          *,
          *:before,
          *:after {
            box-sizing: inherit;
          }

          body {
            margin: 0;
            padding: 0;
          }

          .swagger-ui .topbar {
            display: none;
          }

          .swagger-ui .info {
            margin: 50px 0;
          }

          .swagger-ui .info .title {
            font-size: 36px;
          }
        `}</style>
      </head>
      <div id="swagger-ui" ref={containerRef}></div>
    </>
  );
}
