/**
 * NavBar component
 * Sticky top navigation bar with EviNourish branding,
 * active-link saffron highlight, and a "Scan Now" CTA button.
 */
import { NavLink } from 'react-router-dom';

const NAV_LINKS = [
  { to: '/',               label: 'Dashboard'      },
  { to: '/scan',           label: 'Scan Food'      },
  { to: '/glucose',        label: 'Glucose'        },
  { to: '/glycemic',       label: 'Glycemic'       },
  { to: '/compare',        label: 'Compare'        },
  { to: '/recommendations',label: 'Results'        },
] as const;

export default function NavBar() {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm font-body">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">

        {/* Brand */}
        <NavLink to="/" className="flex items-center gap-2 no-underline">
          <span className="text-xl font-display font-bold text-brand-blue tracking-tight">
            Glyco<span className="text-brand-saffron">Sense</span>
          </span>
          <span className="text-lg">🩺</span>
        </NavLink>

        {/* Links */}
        <ul className="flex items-center gap-1 list-none m-0 p-0">
          {NAV_LINKS.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 no-underline ${
                    isActive
                      ? 'text-brand-saffron bg-orange-50'
                      : 'text-slate-600 hover:text-brand-blue hover:bg-blue-50'
                  }`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <NavLink
          to="/scan"
          className="bg-brand-saffron hover:bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md no-underline"
        >
          Scan Now →
        </NavLink>

      </div>
    </nav>
  );
}
