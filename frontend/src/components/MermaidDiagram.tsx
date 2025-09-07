'use client';
import { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  id?: string;
}

const MermaidDiagram = ({ chart, id = 'mermaid-diagram' }: MermaidDiagramProps) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartRef.current && chart) {
      // Initialize mermaid with configuration
      mermaid.initialize({
        startOnLoad: true,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#3b82f6',
          primaryTextColor: '#ffffff',
          primaryBorderColor: '#1e40af',
          lineColor: '#6b7280',
          secondaryColor: '#1f2937',
          tertiaryColor: '#374151',
          background: '#111827',
          tertiaryTextColor: '#d1d5db',
          fontSize: '16px'
        },
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        }
      });

      // Generate unique ID for each diagram
      const diagramId = `${id}-${Date.now()}`;
      
      // Clear previous content
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }

      // Render the mermaid diagram
      mermaid.render(diagramId, chart)
        .then((result) => {
          if (chartRef.current) {
            chartRef.current.innerHTML = result.svg;
          }
        })
        .catch((error) => {
          console.error('Mermaid rendering error:', error);
          if (chartRef.current) {
            chartRef.current.innerHTML = `
              <div class="p-4 bg-red-900/20 border border-red-500/20 rounded-lg text-red-300">
                <p class="font-semibold">Diagram rendering error</p>
                <p class="text-sm mt-1">Failed to render the flowchart. Raw code:</p>
                <pre class="text-xs mt-2 p-2 bg-gray-800 rounded overflow-x-auto">${chart}</pre>
              </div>
            `;
          }
        });
    }
  }, [chart, id]);

  return (
    <div className="mermaid-container bg-gray-800 p-4 rounded-lg border border-gray-600 overflow-x-auto">
      <div ref={chartRef} className="mermaid-diagram"></div>
    </div>
  );
};

export default MermaidDiagram;