// ================================================================
// IMMORTAIL™ — NAV BAR
// Bottom navigation. Routes through router.js exclusively.
// ================================================================

import React from 'react';
import { motion } from 'framer-motion';
import { ROUTES } from '@/core/constants.js';
import { navigate } from '@/core/router.js';
import styles from './NavBar.module.css';

const NAV_ITEMS = [
  { route: ROUTES.HOME,     icon: '✦',   label: 'Home'     },
  { route: ROUTES.MY_DOG,   icon: '🐾',  label: 'My Dog'   },
  { route: ROUTES.MEMORIES, icon: '📷',  label: 'Memories' },
  { route: ROUTES.SETTINGS, icon: '⚙',   label: 'Settings' },
];

export default function NavBar({ currentRoute }) {
  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(item => {
        const active = currentRoute === item.route;
        return (
          <button
            key={item.route}
            className={`${styles.navItem} ${active ? styles.active : ''}`}
            onClick={() => navigate(item.route)}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
          >
            <span className={styles.icon}>{item.icon}</span>
            {active && (
              <motion.div
                className={styles.activeIndicator}
                layoutId="navActive"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className={styles.label}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
