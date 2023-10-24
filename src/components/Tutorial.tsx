import React from 'react';
import { Form, Button } from "react-bootstrap";
import ReactMarkdown from 'react-markdown';
import TutorialMarkDown from './tutorial.md?raw';

type TutorialProps = {
  unmount: () => void,
}
class Tutorial extends React.Component<TutorialProps, {}> {
  constructor(props: TutorialProps | Readonly<TutorialProps>) {
    super(props);
    this.state = {};

    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleSubmit(event: { preventDefault: () => void; }) {
    event.preventDefault();
    this.props.unmount();
  }


  render() {
    return (
      <div className="fill-window">
        <Form onSubmit={this.handleSubmit}>
           {/*@ts-ignore */}
          <ReactMarkdown className="markdown">{TutorialMarkDown}</ReactMarkdown>
          <Button style={{ "width": "50%" }} type="submit" variant="secondary" value="Submit">Continue to GraphWaGu!</ Button>
        </Form>
      </ div>
    );
  }
}

export default Tutorial;