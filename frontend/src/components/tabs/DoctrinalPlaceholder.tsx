import { Fragment } from 'react';

const ALL_TABS = ['understand', 'design', 'plan', 'direct', 'cop', 'assess'] as const;
const TAB_DISPLAY: Record<string, string> = {
  understand: 'Understand',
  design: 'Design',
  plan: 'Plan',
  direct: 'Direct',
  cop: 'COP',
  assess: 'Assess',
};

interface DoctrinalPlaceholderProps {
  tabId: string;
  tabName: string;
  description: string;
  futureContent: string;
  deliveredBy: string;
}

export function DoctrinalPlaceholder({
  tabId,
  tabName,
  description,
  futureContent,
  deliveredBy,
}: DoctrinalPlaceholderProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center max-w-2xl mx-auto px-4">
      {/* Workflow position indicator */}
      <div className="flex flex-row items-center gap-1 mb-8 flex-wrap justify-center">
        {ALL_TABS.map((tab, index) => (
          <Fragment key={tab}>
            {index > 0 && (
              <span className="text-gray-500 text-sm select-none">›</span>
            )}
            <span
              className={`px-3 py-1 rounded text-sm font-medium ${
                tab === tabId
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-400'
              }`}
            >
              {TAB_DISPLAY[tab]}
            </span>
          </Fragment>
        ))}
      </div>

      {/* Tab heading and description */}
      <h2 className="text-xl font-semibold text-gray-200 mb-2">{tabName}</h2>
      <p className="text-sm text-gray-400 text-center mb-6">{description}</p>

      {/* Coming soon card */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-full">
        <h3 className="text-base font-medium text-gray-300 mb-2">
          Coming in {deliveredBy}
        </h3>
        <p className="text-sm text-gray-400">{futureContent}</p>
      </div>
    </div>
  );
}
