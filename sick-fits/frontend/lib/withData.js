import withApollo from 'next-with-apollo';
import ApolloClient from 'apollo-boost';
import { endpoint } from '../config';
import {LOCAL_STATE_QUERY} from '../components/Cart';

function createClient({ headers }) {
  return new ApolloClient({
    uri: process.env.NODE_ENV === 'development' ? endpoint : endpoint,
    request: operation => {
      operation.setContext({
        fetchOptions: {
          credentials: 'include',
        },
        headers,
      });
    },
    // local data
    clientState: {
      resolvers: {
        Mutation: {
          // cache from the client
          toggleCart(_, variables, {cache}) {
            // read the cart open value from cache
            const {cartOpen} = cache.readQuery({
              query: LOCAL_STATE_QUERY
            });

            // Write cart state into opposite
            const data = {
              data: {cartOpen: !cartOpen}              
            };
            cache.writeData(data);
            return data;
          }
        }
      },
      defaults: {
        cartOpen: false
      }
    }
  });
}

export default withApollo(createClient);
