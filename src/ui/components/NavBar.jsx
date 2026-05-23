// ================================================================
// IMMORTAIL™ — NAV BAR
// Metallic gold/silver bottom navigation.
// ================================================================

import React from 'react';
import { motion } from 'framer-motion';
import { ROUTES } from '@/core/constants.js';
import { navigate } from '@/core/router.js';
import styles from './NavBar.module.css';

const NAV_ITEMS = [
  { route: ROUTES.HOME,     icon: '✦',  label: 'Home'     },
  { route: ROUTES.MY_DOG,  icon: '🐾', label: 'My Dog'   },
  { route: ROUTES.MEMORIES,icon: '📷', label: 'Memories' },
  { route: ROUTES.SETTINGS,icon: '⚙',  label: 'Settings' },
];

export default function NavBar({ currentRoute }) {
  return (
    <nav className={styles.nav}>
      {NAV_ITEMS.map(item => {
        const active = currentRoute === item.route;
        return (
          <motion.button
            key={item.route}
            className={`${styles.navItem} ${active ? styles.active : ''}`}
            onClick={() => navigate(item.route)}
            aria-label={item.label}
            aria-current={active ? 'page' : undefined}
            whileTap={{ scale: 0.88 }}
          >
            {active && (
              <motion.div
                className={styles.activeIndicator}
                layoutId="navActive"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className={styles.icon}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </motion.button>
        );
      })}
    </nav>
  );
}
