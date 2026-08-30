import React from 'react';
import { 
  GraduationCap, 
  ShoppingCart, 
  CalendarCheck, 
  UserSquare2, 
  UtensilsCrossed 
} from 'lucide-react';

const prompts = [
  {
    title: 'Create a student result management website',
    icon: GraduationCap,
    iconColor: 'text-indigo-600 bg-indigo-50',
    promptText: 'Build a student result management website with login, student marks, percentage, grade, and admin dashboard.'
  },
  {
    title: 'Build an e-commerce website',
    icon: ShoppingCart,
    iconColor: 'text-amber-600 bg-amber-50',
    promptText: 'Create a modern e-commerce storefront with product filters, shopping cart, and Razorpay checkout flow.'
  },
  {
    title: 'Create a college attendance management system',
    icon: CalendarCheck,
    iconColor: 'text-blue-600 bg-blue-50',
    promptText: 'Build a college attendance tracking dashboard with student rosters, daily absence logs, and automated email alerts.'
  },
  {
    title: 'Build a portfolio website',
    icon: UserSquare2,
    iconColor: 'text-purple-600 bg-purple-50',
    promptText: 'Create a developer portfolio with hero banner, interactive project showcases, tech badges, and contact form.'
  },
  {
    title: 'Create a restaurant website',
    icon: UtensilsCrossed,
    iconColor: 'text-orange-600 bg-orange-50',
    promptText: 'Create a modern restaurant menu and table reservation web application with online order management.'
  },
];

export default function ExamplePrompts({ onSelectPrompt }) {
  return (
    <div className="w-full">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Try these example prompts
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {prompts.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectPrompt(p.promptText)}
              className="group text-left p-3.5 bg-white border border-gray-100/80 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.08)] hover:border-brand-300 transition-all duration-200 flex flex-col justify-between"
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-3 ${p.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xs font-medium text-gray-700 leading-snug group-hover:text-brand-700">
                {p.title}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}