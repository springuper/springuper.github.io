import React, { Component } from 'react';

class Person extends Component {
  componentWillReceiveProps(nextProps) {
    console.log('===componentWillReceiveProps', nextProps);
  }

  render() {
    return (
      <div>
        Hello, {this.props.name}
      </div>
    );
  }
}

export default Person;
