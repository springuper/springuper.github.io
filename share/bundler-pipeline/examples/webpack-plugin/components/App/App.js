import React from 'react';
import TopNav from '../TopNav/TopNav';
import styles from './App.css';

const App = React.createClass({
  render() {
    return (
      <div>
        <TopNav />
        <div className={styles.contentWrapper}>
          content
        </div>
      </div>
    );
  }
});

export default App;
