import React from 'react';
import CartStyles from './styles/CartStyles';
import Supreme from './styles/Supreme';
import CloseButton from './styles/CloseButton';
import SickButton from './styles/SickButton';

const Cart = () => {
	return (
		<CartStyles open>
			<header>
				<CloseButton title="close">&times;</CloseButton>
				<Supreme>Your Cart</Supreme>
				<p>You have x items in your cart.</p>
				<footer>
					<p>$0.00</p>
					<SickButton>Checkout</SickButton>
				</footer>
			</header>
		</CartStyles>		
	)
};

export default Cart;

