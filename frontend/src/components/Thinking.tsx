'use client';

interface ThinkingProps {
steps: string[];
}

const Thinking = ({ steps }: ThinkingProps) => {
if (!steps || steps.length === 0) return null;

return (
<details className="mt-2 text-sm text-gray-400 cursor-pointer">
<summary className="outline-none">View thought process...</summary>
<div className="mt-2 p-3 border-l-2 border-gray-600 bg-gray-900/50 rounded-r-md space-y-1">
{steps.map((step, i) => (
<p key={i} className="whitespace-pre-wrap">{step}</p>
))}
</div>
</details>
);
};

export default Thinking;