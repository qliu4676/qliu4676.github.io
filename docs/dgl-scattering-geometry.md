# The 3D scattering geometry

The cleanest way to follow this calculation is to put the observer, grain, and source into one Cartesian coordinate system and let the vectors do the bookkeeping.

## Set the scene

Put the observer at the origin,

\[
O=(0,0,0).
\]

The line of sight lies in the \(x\)-\(z\) plane at Galactic latitude \(b\). A grain at height \(z\) is therefore at

\[
G=(z\cot b,0,z).
\]

Now take a stellar sheet at height \(z_s\). The point in that sheet vertically aligned with the grain is

\[
P=(z\cot b,0,z_s).
\]

Around \(P\), draw an annulus of radius \(R\). Following the BD12 description, \(\theta=0\) points away from the observer. A source on the annulus is then

\[
S=\left(z\cot b+R\cos\theta,\;R\sin\theta,\;z_s\right).
\]

This one line fixes the full three-dimensional geometry.

## Follow the photon

The photon arrives at the grain from the source, so its incoming unit vector is

\[
\hat{\boldsymbol{k}}_{\mathrm{in}}
=\frac{G-S}{|G-S|}
=\frac{\left(-R\cos\theta,-R\sin\theta,z-z_s\right)}
{\sqrt{R^2+(z-z_s)^2}}.
\]

After scattering, it travels from the grain to the observer. The outgoing unit vector is

\[
\hat{\boldsymbol{k}}_{\mathrm{out}}
=\frac{O-G}{|O-G|}
=(-\cos b,0,-\sin b).
\]

The scattering angle \(\xi\) is the angle between these two propagation directions:

\[
\cos\xi
=\hat{\boldsymbol{k}}_{\mathrm{in}}
\mathbin{\boldsymbol{\cdot}}
\hat{\boldsymbol{k}}_{\mathrm{out}}.
\]

Taking the dot product gives

\[
\boxed{
\cos\xi=
\frac{R\cos b\cos\theta-(z-z_s)\sin b}
{\sqrt{R^2+(z-z_s)^2}}
}.
\]

That is the scattering cosine used by the phase function.

## A check from the triangle

The three points \(O\), \(G\), and \(S\) also form a triangle. Its side lengths are

\[
|OG|=z\csc b,
\qquad
|GS|=\sqrt{R^2+(z-z_s)^2},
\]

and

\[
|OS|^2=z^2\cot^2b+R^2
+2Rz\cot b\cos\theta+z_s^2.
\]

If \(\gamma\) is the angle at the grain between the geometric rays toward the source and observer, the law of cosines gives

\[
\cos\gamma=
\frac{|OG|^2+|GS|^2-|OS|^2}
{2|OG||GS|}.
\]

Substituting the three side lengths yields

\[
\cos\gamma=
\frac{z(z-z_s)-Rz\cot b\cos\theta}
{\sqrt{z^2\cot^2b+z^2}\sqrt{R^2+(z-z_s)^2}}.
\]

Since the incoming photon travels from \(S\) to \(G\), while the geometric ray above points from \(G\) to \(S\), the two angles satisfy \(\xi=\pi-\gamma\). This reduces to the same expression for \(\cos\xi\) obtained directly from the propagation vectors.
