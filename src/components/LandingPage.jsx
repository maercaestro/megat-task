import React from 'react';
import logo from '../assets/logo2.png';
import mainImage from '../assets/main.png';
import step1Image from '../assets/add-task.png';
import step2Image from '../assets/ai-task1.png';
import step3Image from '../assets/ai-task2.png';
import { 
  SparklesIcon, 
  CheckIcon, 
  ArrowRightIcon,
  ChatBubbleBottomCenterIcon,
  CalendarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const LandingPage = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-emerald-50 overflow-x-hidden">
      {/* Navigation */}
      <nav className="w-full px-6 sm:px-10 py-4">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Megat-Task Logo" className="h-15 w-15 rounded-lg" />
            <span className="text-2xl font-bold mt-4 bg-gradient-to-r from-blue-600 to-emerald-500 bg-clip-text text-transparent">Megat-Task</span>
          </div>
          <button 
            onClick={onGetStarted}
            className="px-4 py-2 bg-transparent border border-blue-600 text-blue-600 rounded-lg 
              hover:bg-blue-700 hover:text-gray-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="w-full px-6 sm:px-10 py-16 sm:py-20">
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold text-gray-800 leading-tight">
                Supercharge your productivity with AI
              </h1>
              <p className="mt-4 text-xl text-gray-600">
                Megat-Task combines intelligent task management with AI-powered completion to help you accomplish more.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button 
                  onClick={onGetStarted}
                  className="px-6 py-3 bg-blue-600 text-gray-700 rounded-lg shadow-lg
                    hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  Get Started
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
                <button 
                  className="px-6 py-3 bg-white text-gray-700 rounded-lg shadow-lg
                    hover:bg-gray-50 transition-colors"
                >
                  Learn More
                </button>
              </div>
            </div>
            <div className="hidden lg:block bg-white p-6 rounded-2xl shadow-xl transform rotate-1">
              {/* App screenshot or illustration placeholder */}
              <div className="w-full h-80 bg-gray-100 rounded-lg flex items-center justify-center">
                <img 
                src={mainImage}
                alt="Megat-Task App Screenshot"
                className="w-full h-full object-cover rounded-lg"/>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full px-6 sm:px-10 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800">
            Designed for efficiency
          </h2>
          <p className="mt-4 text-center text-gray-600 max-w-2xl mx-auto">
            Megat-Task combines intelligent task management with powerful AI capabilities to help you focus on what matters.
          </p>
          
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="p-6 bg-blue-50 rounded-xl">
              <SparklesIcon className="h-10 w-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">AI-Powered Tasks</h3>
              <p className="mt-2 text-gray-600">
                Let AI assist you with research, summaries, and creative ideas - all integrated with your tasks.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="p-6 bg-emerald-50 rounded-xl">
              <ChatBubbleBottomCenterIcon className="h-10 w-10 text-emerald-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">Contextual Chat</h3>
              <p className="mt-2 text-gray-600">
                Chat with an AI assistant that understands your tasks and can help you complete them.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="p-6 bg-purple-50 rounded-xl">
              <CalendarIcon className="h-10 w-10 text-purple-600 mb-4" />
              <h3 className="text-xl font-semibold text-gray-800">Smart Organization</h3>
              <p className="mt-2 text-gray-600">
                Organize tasks by date, priority and section - with AI automatically categorizing items.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 sm:px-10 py-20 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-800">
            How Megat-Task works
          </h2>
          
          <div className="mt-16 space-y-20">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="order-2 md:order-1 md:w-1/2">
                <div className="bg-white p-4 rounded-xl shadow-lg h-64 flex items-center justify-center">
                  <img src={step1Image} alt="Step 1 Visual" className="h-full w-full object-cover rounded-lg" />
                </div>
              </div>
              <div className="order-1 md:order-2 md:w-1/2">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">Add a task with AI analysis</h3>
                    <p className="mt-2 text-gray-600">
                      Enter your task and let our AI immediately analyze it for priority, category, and AI capabilities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="md:w-1/2">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">Execute with AI assistance</h3>
                    <p className="mt-2 text-gray-600">
                      Use our AI to automatically research, draft responses, or generate content based on your tasks.
                    </p>
                  </div>
                </div>
              </div>
              <div className="md:w-1/2">
                <div className="bg-white p-4 rounded-xl shadow-lg h-64 flex items-center justify-center">
                  <img src={step2Image} alt="Step 2 Visual" className="h-full w-full object-cover rounded-lg" />
                </div>
              </div>
            </div>
            
            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-10 items-center">
              <div className="order-2 md:order-1 md:w-1/2">
                <div className="bg-white p-4 rounded-xl shadow-lg h-64 flex items-center justify-center">
                  <img src={step3Image} alt="Step 3 Visual" className="h-full w-full object-cover rounded-lg" />
                </div>
              </div>
              <div className="order-1 md:order-2 md:w-1/2">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800">Review and refine with chat</h3>
                    <p className="mt-2 text-gray-600">
                      Chat directly with our AI about your task results, ask for revisions, or explore alternatives.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 sm:px-10 py-16 bg-gradient-to-r from-blue-600 to-blue-800 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold">Ready to boost your productivity?</h2>
          <p className="mt-4 text-blue-100 text-lg">
            Join thousands of users who have transformed their workflow with Megat-Task.
          </p>
          <button 
            onClick={onGetStarted}
            className="mt-8 px-8 py-4 bg-white text-blue-700 font-medium rounded-lg shadow-lg 
              hover:bg-blue-50 transition-colors inline-flex items-center gap-2"
          >
            Get Started Now
            <ArrowRightIcon className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 sm:px-10 py-10 bg-gray-900 text-gray-700">
        <div className="w-full">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-6 md:mb-0">
              <img src={logo} alt="Megat-Task Logo" className="h-8 w-8 rounded-lg" />
              <span className="text-lg font-bold text-white">Megat-Task</span>
            </div>
            <div className="flex flex-wrap gap-6 justify-center">
              <button className="hover:text-blue-700 transition-colors">About</button>
              <button className="hover:text-blue-700 transition-colors">Features</button>
              <button className="hover:text-blue-700 transition-colors">Pricing</button>
              <button className="hover:text-blue-700 transition-colors">Support</button>
              <button className="hover:text-blue-700 transition-colors">Privacy</button>
              <button className="hover:text-blue-700 transition-colors">Terms</button>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-white">
            <p>© {new Date().getFullYear()} Megat-Task. All rights reserved.</p>
            <p className="mt-2 text-sm">Created by Abu Huzaifah Bidin</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;